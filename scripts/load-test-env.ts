export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set (these scripts only ever run against a disposable database)`);
  return value;
}
