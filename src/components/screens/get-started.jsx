import { useState } from "react";
import { FloatingInput } from "../ui/input";
import { BaseHeader } from "../widget-header";

const SUPPORTED_INPUT_TYPES = ["email", "number", "tel", "text", "url"];

export function LeadFormScreen({
  config,
  headerProps,
  fields,
  isSubmitting,
  error,
  onSubmit,
}) {
  const [isConsentAccepted, setIsConsentAccepted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    if (config.requireConsent && !isConsentAccepted) return;

    const formData = new FormData(event.currentTarget);
    const leadData = Object.fromEntries(
      fields.map((field) => [
        field.value,
        String(formData.get(field.value) ?? "").trim(),
      ]),
    );
    onSubmit(leadData);
  }

  return (
    <div className="argon-lead-screen">
      <BaseHeader {...headerProps} />
      <form className="argon-lead-form" onSubmit={handleSubmit}>
        <div className="argon-message argon-message--bot">
          {config.introMessage}
        </div>
        <div className="argon-lead-fields">
          {fields.map((field, index) => (
            <FloatingInput
              key={field.value}
              id={`argon-lead-${index}`}
              name={field.value}
              label={field.label || field.value}
              type={SUPPORTED_INPUT_TYPES.includes(field.type) ? field.type : "text"}
              required={field.mode === "required"}
              optional={field.mode === "optional"}
              autoComplete={field.value}
              disabled={isSubmitting}
            />
          ))}
        </div>
        {config.requireConsent && (
          <label className="argon-consent" htmlFor="argon-lead-consent">
            <input
              id="argon-lead-consent"
              type="checkbox"
              checked={isConsentAccepted}
              required
              disabled={isSubmitting}
              onChange={(event) => setIsConsentAccepted(event.target.checked)}
            />
            <span>
              {config.consentMessage ||
                "I agree to the collection of my information."}
            </span>
          </label>
        )}
        {error && (
          <p className="argon-lead-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={
            isSubmitting || (config.requireConsent && !isConsentAccepted)
          }
        >
          {isSubmitting ? "Starting chat…" : "Start chat"}
        </button>
      </form>
    </div>
  );
}
