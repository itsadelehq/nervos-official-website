import { useRef, useState, type FormEvent } from 'react'
import { api } from '../../utils/api'
import { newsletterSignupInput } from '../../utils/newsletter'
import { trackKBEvent } from './analytics'

export function useNewsletterSignup(placement: 'signal' | 'footer', language = 'en') {
  const chinese = language === 'zh'
  const { mutateAsync } = api.newsLetter.signup.useMutation({ retry: false })
  const pending = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)
  const [isInvalid, setIsInvalid] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending.current) return
    const form = event.currentTarget
    const input = newsletterSignupInput.safeParse({ email: new FormData(form).get('email') })
    if (!input.success) {
      setStatus(chinese ? '请输入有效的电子邮箱地址。' : 'Please enter a valid email address.')
      setIsError(true)
      setIsInvalid(true)
      return
    }

    pending.current = true
    setIsSubmitting(true)
    setIsError(false)
    setIsInvalid(false)
    setStatus(chinese ? '提交中…' : 'Submitting…')
    try {
      const result = await mutateAsync({ email: input.data.email })
      if (!result.success) throw new Error('Newsletter signup was not accepted')
      setStatus(chinese ? '感谢订阅！我们已收到你的订阅请求。' : 'Thanks! Your signup request was received.')
      form.reset()
      trackKBEvent('kb_newsletter_submit', { placement, status: 'accepted' })
      trackKBEvent('kb_newsletter_result', { placement, outcome: 'accepted' })
    } catch {
      setIsError(true)
      setStatus(
        chinese
          ? '提交失败，请重试或联系 media@nervos.org。'
          : 'Unable to submit. Please try again or contact media@nervos.org.',
      )
      trackKBEvent('kb_newsletter_result', { placement, outcome: 'error' })
    } finally {
      pending.current = false
      setIsSubmitting(false)
    }
  }

  return { onSubmit, isSubmitting, status, isError, isInvalid }
}
