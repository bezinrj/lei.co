import { sendLovableEmail } from '@lovable.dev/email-js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

import type { Database } from '@/integrations/supabase/types'

const MAX_RETRIES = 5
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_SEND_DELAY_MS = 200
const DEFAULT_AUTH_TTL_MINUTES = 15
const DEFAULT_TRANSACTIONAL_TTL_MINUTES = 60

type EmailPayload = {
  from?: string
  html?: string
  idempotency_key?: string
  label?: string
  message_id?: string
  purpose?: string
  queued_at?: string
  run_id?: string
  sender_domain?: string
  subject?: string
  text?: string
  to?: string
  unsubscribe_token?: string
  [key: string]: unknown
}

type QueueMessage = {
  enqueued_at?: string
  message: EmailPayload
  msg_id: number
  read_ct?: number
}

type EmailState = {
  auth_email_ttl_minutes?: number | null
  batch_size?: number | null
  retry_after_until?: string | null
  send_delay_ms?: number | null
  transactional_email_ttl_minutes?: number | null
}

type AdminClient = SupabaseClient<Database>

function getAdminClient(url: string, key: string): AdminClient {
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function getDb(client: AdminClient): any {
  return client as any
}

function isRateLimited(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429
  }
  return error instanceof Error && error.message.includes('429')
}

function isForbidden(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 403
  }
  return error instanceof Error && error.message.includes('403')
}

function getRetryAfterSeconds(error: unknown): number {
  if (error && typeof error === 'object' && 'retryAfterSeconds' in error) {
    return (error as { retryAfterSeconds: number | null }).retryAfterSeconds ?? 60
  }
  return 60
}

async function insertEmailLog(client: AdminClient, row: Record<string, unknown>): Promise<void> {
  await getDb(client).from('email_send_log').insert(row)
}

async function moveToDlq(
  client: AdminClient,
  queue: string,
  msg: QueueMessage,
  reason: string
): Promise<void> {
  const payload = msg.message

  await insertEmailLog(client, {
    error_message: reason,
    message_id: payload.message_id,
    recipient_email: payload.to,
    status: 'dlq',
    template_name: payload.label || queue,
  })

  const { error } = await getDb(client).rpc('move_to_dlq', {
    dlq_name: `${queue}_dlq`,
    message_id: msg.msg_id,
    payload,
    source_queue: queue,
  })

  if (error) {
    console.error('Failed to move message to DLQ', { error, msg_id: msg.msg_id, queue, reason })
  }
}

export const Route = createFileRoute('/lovable/email/queue/process')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.slice('Bearer '.length).trim()
        if (token !== supabaseServiceKey) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase = getAdminClient(supabaseUrl, supabaseServiceKey)
        const db = getDb(supabase)

        const { data: state } = await db
          .from('email_send_state')
          .select('retry_after_until, batch_size, send_delay_ms, auth_email_ttl_minutes, transactional_email_ttl_minutes')
          .single<EmailState>()

        if (state?.retry_after_until && new Date(state.retry_after_until) > new Date()) {
          return Response.json({ reason: 'rate_limited', skipped: true })
        }

        const batchSize = state?.batch_size ?? DEFAULT_BATCH_SIZE
        const sendDelayMs = state?.send_delay_ms ?? DEFAULT_SEND_DELAY_MS
        const ttlMinutes: Record<string, number> = {
          auth_emails: state?.auth_email_ttl_minutes ?? DEFAULT_AUTH_TTL_MINUTES,
          transactional_emails: state?.transactional_email_ttl_minutes ?? DEFAULT_TRANSACTIONAL_TTL_MINUTES,
        }

        let totalProcessed = 0

        for (const queue of ['auth_emails', 'transactional_emails'] as const) {
          const { data: rawMessages, error: readError } = await db.rpc('read_email_batch', {
            batch_size: batchSize,
            queue_name: queue,
            vt: 30,
          })

          if (readError) {
            console.error('Failed to read email batch', { error: readError, queue })
            continue
          }

          const messages = (rawMessages ?? []) as QueueMessage[]
          if (!messages.length) continue

          const messageIds = Array.from(
            new Set(
              messages
                .map((msg) =>
                  msg?.message?.message_id && typeof msg.message.message_id === 'string'
                    ? msg.message.message_id
                    : null
                )
                .filter((id): id is string => Boolean(id))
            )
          )

          const failedAttemptsByMessageId = new Map<string, number>()

          if (messageIds.length > 0) {
            const { data: failedRows, error: failedRowsError } = await db
              .from('email_send_log')
              .select('message_id')
              .in('message_id', messageIds)
              .eq('status', 'failed')

            if (failedRowsError) {
              console.error('Failed to load failed-attempt counters', {
                error: failedRowsError,
                queue,
              })
            } else {
              for (const row of failedRows ?? []) {
                const messageId = row?.message_id
                if (typeof messageId !== 'string' || !messageId) continue
                failedAttemptsByMessageId.set(
                  messageId,
                  (failedAttemptsByMessageId.get(messageId) ?? 0) + 1
                )
              }
            }
          }

          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]
            const payload = msg.message
            const failedAttempts =
              payload.message_id && typeof payload.message_id === 'string'
                ? (failedAttemptsByMessageId.get(payload.message_id) ?? 0)
                : (msg.read_ct ?? 0)

            const queuedAt = payload.queued_at ?? msg.enqueued_at
            if (queuedAt) {
              const ageMs = Date.now() - new Date(queuedAt).getTime()
              const maxAgeMs = ttlMinutes[queue] * 60 * 1000
              if (ageMs > maxAgeMs) {
                console.warn('Email expired (TTL exceeded)', {
                  msg_id: msg.msg_id,
                  queue,
                  queued_at: queuedAt,
                  ttl_minutes: ttlMinutes[queue],
                })
                await moveToDlq(supabase, queue, msg, `TTL exceeded (${ttlMinutes[queue]} minutes)`)
                continue
              }
            }

            if (failedAttempts >= MAX_RETRIES) {
              await moveToDlq(
                supabase,
                queue,
                msg,
                `Max retries (${MAX_RETRIES}) exceeded (attempted ${failedAttempts} times)`
              )
              continue
            }

            if (payload.message_id) {
              const { data: alreadySent } = await db
                .from('email_send_log')
                .select('id')
                .eq('message_id', payload.message_id)
                .eq('status', 'sent')
                .maybeSingle()

              if (alreadySent) {
                console.warn('Skipping duplicate send (already sent)', {
                  message_id: payload.message_id,
                  msg_id: msg.msg_id,
                  queue,
                })
                const { error: dupDelError } = await db.rpc('delete_email', {
                  message_id: msg.msg_id,
                  queue_name: queue,
                })
                if (dupDelError) {
                  console.error('Failed to delete duplicate message from queue', {
                    error: dupDelError,
                    msg_id: msg.msg_id,
                    queue,
                  })
                }
                continue
              }
            }

            try {
              await sendLovableEmail(
                {
                  from: payload.from,
                  html: payload.html,
                  idempotency_key: payload.idempotency_key,
                  label: payload.label,
                  message_id: payload.message_id,
                  purpose: payload.purpose,
                  run_id: payload.run_id,
                  sender_domain: payload.sender_domain,
                  subject: payload.subject,
                  text: payload.text,
                  to: payload.to,
                  unsubscribe_token: payload.unsubscribe_token,
                },
                { apiKey, sendUrl: process.env.LOVABLE_SEND_URL }
              )

              await insertEmailLog(supabase, {
                message_id: payload.message_id,
                recipient_email: payload.to,
                status: 'sent',
                template_name: payload.label || queue,
              })

              const { error: delError } = await db.rpc('delete_email', {
                message_id: msg.msg_id,
                queue_name: queue,
              })
              if (delError) {
                console.error('Failed to delete sent message from queue', {
                  error: delError,
                  msg_id: msg.msg_id,
                  queue,
                })
              }
              totalProcessed++
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error)
              console.error('Email send failed', {
                error: errorMsg,
                failed_attempts: failedAttempts,
                msg_id: msg.msg_id,
                queue,
                read_ct: msg.read_ct,
              })

              if (isRateLimited(error)) {
                await insertEmailLog(supabase, {
                  error_message: errorMsg.slice(0, 1000),
                  message_id: payload.message_id,
                  recipient_email: payload.to,
                  status: 'failed',
                  template_name: payload.label || queue,
                })

                const retryAfterSecs = getRetryAfterSeconds(error)
                await db
                  .from('email_send_state')
                  .update({
                    retry_after_until: new Date(Date.now() + retryAfterSecs * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', 1)

                return Response.json({ processed: totalProcessed, stopped: 'rate_limited' })
              }

              if (isForbidden(error)) {
                await moveToDlq(supabase, queue, msg, 'Emails disabled for this project')
                return Response.json({ processed: totalProcessed, stopped: 'emails_disabled' })
              }

              await insertEmailLog(supabase, {
                error_message: errorMsg.slice(0, 1000),
                message_id: payload.message_id,
                recipient_email: payload.to,
                status: 'failed',
                template_name: payload.label || queue,
              })

              if (payload.message_id && typeof payload.message_id === 'string') {
                failedAttemptsByMessageId.set(payload.message_id, failedAttempts + 1)
              }
            }

            if (i < messages.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, sendDelayMs))
            }
          }
        }

        return Response.json({ processed: totalProcessed })
      },
    },
  },
})
