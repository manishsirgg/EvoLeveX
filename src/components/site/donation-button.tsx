'use client'

import { useEffect, useRef } from 'react'

const RAZORPAY_PAYMENT_BUTTON_ID = 'pl_TTuqamQjhJ1Sjl'

export function DonationButton() {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const form = formRef.current

    if (!form) return

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js'
    script.dataset.payment_button_id = RAZORPAY_PAYMENT_BUTTON_ID
    script.async = true
    form.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])

  return (
    <div className="site-footer-donation">
      <p id="footer-donation-label">Fuel the evolution</p>
      <form ref={formRef} aria-labelledby="footer-donation-label" />
    </div>
  )
}
