export function NewPasswordFields({ label = 'Password' }: { label?: string }) {
  return <>
    <label className="field"><span>{label}</span>
      <input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" />
      <small>Use at least 12 characters.</small>
    </label>
    <label className="field"><span>Confirm password</span>
      <input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" />
    </label>
  </>
}
