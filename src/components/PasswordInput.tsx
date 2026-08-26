"use client";

import { useState } from "react";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  className?: string;
}

export default function PasswordInput({ value, onChange, placeholder, required, minLength, className }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={className ?? "w-full border rounded-lg px-3 py-2 pr-20"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:underline"
      >
        {show ? "Sembunyikan" : "Lihat"}
      </button>
    </div>
  );
}
