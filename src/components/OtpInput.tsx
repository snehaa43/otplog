"use client";

import React, { useRef, useEffect } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  hasError?: boolean;
  onComplete?: (otp: string) => void;
}

export default function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  hasError = false,
  onComplete,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length }, (_, i) => value[i] || "");

  useEffect(() => {
    if (!value && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digit = rawVal.replace(/\D/g, "").slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    const newOtp = newDigits.join("");
    onChange(newOtp);

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.length === length && onComplete) {
      onComplete(newOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();
    const cleaned = pastedData.replace(/\D/g, "").slice(0, length);

    if (cleaned.length > 0) {
      onChange(cleaned);
      const focusIndex = Math.min(cleaned.length, length - 1);
      inputRefs.current[focusIndex]?.focus();

      if (cleaned.length === length && onComplete) {
        onComplete(cleaned);
      }
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-2.5">
      {Array.from({ length }).map((_, index) => {
        const isFilled = Boolean(digits[index]);
        const isCurrent = digits.findIndex((d) => !d) === index;

        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digits[index]}
            disabled={disabled}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-mono font-bold rounded-lg border transition-all outline-none
              ${
                hasError
                  ? "border-black bg-zinc-100 text-black ring-1 ring-black"
                  : isFilled
                  ? "border-black bg-white text-black font-extrabold"
                  : isCurrent
                  ? "border-black bg-white text-black ring-1 ring-black/20"
                  : "border-zinc-300 bg-white text-black hover:border-zinc-400"
              }
              ${disabled ? "opacity-40 cursor-not-allowed bg-zinc-100" : ""}
            `}
            aria-label={`Digit ${index + 1} of verification code`}
          />
        );
      })}
    </div>
  );
}
