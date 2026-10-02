import { useMemo, useState } from "react";
import {
  formatBusinessTimeRange,
  formatDateTimeRange,
  formatDayLabel,
  formatOffsetLabel,
  formatShortDay,
  formatTimeRange,
  getUserTimeZoneLabel,
  localDayKey,
  slotRange,
  toOffsetIsoString,
} from "../lib/appointmentTime";
import { FloatingInput } from "./ui/input";
import { ScrollContainer } from "./ui/scroll-container";

const SUPPORTED_INPUT_TYPES = ["email", "number", "tel", "text", "url"];

function buildSlots(appointment) {
  return (appointment?.available_slots ?? [])
    .map((slot, index) => {
      const range = slotRange(appointment, slot);
      if (!range) return null;
      return {
        id: `${index}-${slot.start_time ?? ""}`,
        startsAt: toOffsetIsoString(range.start, range.offsetMinutes),
        start: range.start,
        end: range.end,
        offsetMinutes: range.offsetMinutes,
      };
    })
    .filter(Boolean);
}

export function AppointmentBooking({
  message,
  config,
  leadData,
  onBook,
  onBooked,
  onCancelled,
}) {
  const appointment = message.metadata.appointments;
  const fields = config.appointmentConfig?.fields ?? [];
  const language = config.language;
  const slots = useMemo(() => buildSlots(appointment), [appointment]);
  const referenceDayKey = slots.length ? localDayKey(slots[0].start) : "";
  const timezoneLabel = useMemo(
    () => getUserTimeZoneLabel(slots[0]?.start ?? new Date()),
    [slots],
  );
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [formValues, setFormValues] = useState(() =>
    Object.fromEntries(
      fields.map((field) => [
        field.value,
        leadData?.[field.value] != null ? String(leadData[field.value]) : "",
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;
  const dayLabel = slots.length ? formatDayLabel(slots[0].start, language) : "";

  function handleFieldChange(name, value) {
    setFormValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedSlot || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const collectedFields = {};
      fields.forEach((field) => {
        const value = String(formValues[field.value] ?? "").trim();
        if (value) collectedFields[field.value] = value;
      });
      const result = await onBook({
        startsAt: selectedSlot.startsAt,
        collectedFields,
      });
      onBooked(result);
    } catch (submitError) {
      setError(
        submitError.message || "The appointment could not be booked.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form className="argon-booking" onSubmit={handleSubmit}>
      <ScrollContainer className="argon-booking-scroll">
        <div className="argon-booking-header">
          <strong>Pick a time{dayLabel ? ` – ${dayLabel}` : ""}</strong>
          <span className="argon-booking-timezone">
            Times shown in your timezone ({timezoneLabel})
          </span>
        </div>

        {slots.length > 0 && (
          <div
            className="argon-slot-grid"
            role="group"
            aria-label="Available appointment slots"
          >
            {slots.map((slot) => {
              const userOffsetMinutes = -slot.start.getTimezoneOffset();
              const showBusinessTime =
                slot.offsetMinutes !== userOffsetMinutes;
              const shiftedDay = localDayKey(slot.start);
              const showDay = Boolean(
                referenceDayKey && shiftedDay !== referenceDayKey,
              );
              const isSelected = slot.id === selectedSlotId;
              const localRange = formatTimeRange(
                slot.start,
                slot.end,
                language,
              );
              const title = [
                `${formatDayLabel(slot.start, language)} · ${localRange} (your local time)`,
                ...(showBusinessTime
                  ? [
                      `${formatBusinessTimeRange(slot.start, slot.end, slot.offsetMinutes, language)} ${formatOffsetLabel(slot.offsetMinutes)} business time`,
                    ]
                  : []),
              ].join("\n");
              return (
                <button
                  key={slot.id}
                  type="button"
                  className={
                    isSelected
                      ? "argon-slot argon-slot--selected"
                      : "argon-slot"
                  }
                  aria-pressed={isSelected}
                  disabled={isSubmitting}
                  title={title}
                  onClick={() => setSelectedSlotId(slot.id)}
                >
                  <span className="argon-slot-time">{localRange}</span>
                  {showDay && (
                    <span className="argon-slot-day">
                      {formatShortDay(slot.start, language)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {fields.length > 0 && (
          <div className="argon-booking-fields">
            {fields.map((field, index) => (
              <FloatingInput
                key={field.value}
                id={`argon-booking-${message.id}-${index}`}
                name={field.value}
                label={field.label || field.value}
                type={
                  SUPPORTED_INPUT_TYPES.includes(field.type)
                    ? field.type
                    : "text"
                }
                required={field.mode === "required"}
                optional={field.mode === "optional"}
                autoComplete={field.value}
                value={formValues[field.value] ?? ""}
                disabled={isSubmitting}
                onChange={(event) =>
                  handleFieldChange(field.value, event.target.value)
                }
              />
            ))}
          </div>
        )}

        {error && (
          <p className="argon-booking-error" role="alert">
            {error}
          </p>
        )}
      </ScrollContainer>

      <div className="argon-booking-actions">
        <button
          type="button"
          className="argon-booking-cancel"
          disabled={isSubmitting}
          onClick={onCancelled}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="argon-booking-confirm"
          disabled={!selectedSlot || isSubmitting}
        >
          {isSubmitting ? "Booking…" : "Confirm booking"}
        </button>
      </div>
    </form>
  );
}

export function AppointmentConfirmation({ config, booking }) {
  const start = new Date(booking?.appointment?.starts_at);
  const end = new Date(booking?.appointment?.ends_at);
  const hasStart = !Number.isNaN(start.getTime());
  const hasEnd = !Number.isNaN(end.getTime());
  const label = hasStart
    ? formatDateTimeRange(start, hasEnd ? end : null, config.language)
    : "";

  return (
    <div className="argon-booking-confirmation" role="status">
      <strong>
        {config.appointmentConfig?.confirmationMessage ||
          "Your appointment request was received."}
      </strong>
      {label && <span>{label} · your local time</span>}
    </div>
  );
}

function formatFieldLabel(value) {
  const label = String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Detail";
}

function formatAppointmentStatus(value) {
  const status = String(value || "pending").toLowerCase();
  if (status === "confirmed") return "Confirmed";
  if (status === "cancelled" || status === "canceled") return "Cancelled";
  if (status === "completed") return "Completed";
  return "Pending";
}

export function AppointmentSubmission({ message, language }) {
  const metadata = message?.metadata ?? {};
  const start = new Date(metadata.starts_at);
  const end = new Date(metadata.ends_at);
  const hasStart = !Number.isNaN(start.getTime());
  const hasEnd = !Number.isNaN(end.getTime());
  const fields = Object.entries(metadata.collected_fields ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim(),
  );
  const status = String(metadata.status || "pending").toLowerCase();
  const statusClass = [
    "confirmed",
    "completed",
    "cancelled",
    "canceled",
  ].includes(status)
    ? status
    : "pending";

  return (
    <div className="argon-appointment-message">
      <div className="argon-appointment-message-heading">
        <span className="argon-appointment-message-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
            <path d="m9 14 2 2 4-4" />
          </svg>
        </span>
        <span className="argon-appointment-message-title">
          <strong>Appointment requested</strong>
          <span>Your selected time</span>
        </span>
        <span
          className={`argon-appointment-status argon-appointment-status--${statusClass}`}
        >
          {formatAppointmentStatus(status)}
        </span>
      </div>

      {hasStart && (
        <div className="argon-appointment-message-time">
          <strong>
            {formatDateTimeRange(start, hasEnd ? end : null, language)}
          </strong>
          <span>{getUserTimeZoneLabel(start)} · your local time</span>
        </div>
      )}

      {fields.length > 0 && (
        <details className="argon-appointment-details">
          <summary>
            Submitted details
            <span>{fields.length}</span>
          </summary>
          <dl>
            {fields.map(([name, value]) => (
              <div key={name}>
                <dt>{formatFieldLabel(name)}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
