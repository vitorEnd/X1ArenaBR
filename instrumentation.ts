export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { syncConfiguredSupportUsers } = await import(
    "@/lib/ranked/support-sync"
  );
  try {
    await syncConfiguredSupportUsers();
  } catch {
    // Keep the public site available. Support RPCs remain fail-closed until
    // the database and the environment allowlist can be synchronized again.
    console.error("AXB support allowlist could not be synchronized at startup.");
  }
}
