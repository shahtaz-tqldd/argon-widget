import { forwardRef } from "react";

const Input = forwardRef(function Input(
  { className = "", type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={`argon-input${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
});

const FloatingInput = forwardRef(function FloatingInput(
  {
    id,
    name,
    label,
    optional = false,
    error,
    className = "",
    inputClassName = "",
    type = "text",
    ...props
  },
  ref,
) {
  const inputId = id || name;
  const errorId = inputId ? `${inputId}-error` : undefined;

  return (
    <div
      className={`argon-floating-input${className ? ` ${className}` : ""}`}
    >
      <Input
        {...props}
        ref={ref}
        id={inputId}
        name={name}
        type={type}
        placeholder=" "
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClassName}
      />
      <label htmlFor={inputId}>
        <span>{label}</span>
        {optional && <small>Optional</small>}
      </label>
      {error && (
        <p id={errorId} className="argon-input-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

export { FloatingInput, Input };
