// src/components/payment/IntaSendBadge.tsx

export default function IntaSendBadge() {
  return (
    <div className="flex flex-col items-center py-6">
      <a
        href="https://intasend.com/security"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          src="https://intasend-prod-static.s3.amazonaws.com/img/trust-badges/intasend-trust-badge-with-mpesa-hr-light.png"
          alt="IntaSend Secure Payments"
          width={375}
          className="max-w-full h-auto"
        />
      </a>

      <a
        href="https://intasend.com/security"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 text-xs text-gray-600 hover:underline"
      >
        Secured by IntaSend Payments
      </a>
    </div>
  );
}