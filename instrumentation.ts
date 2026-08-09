export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { syncConfiguredSupportUsers } = await import(
    "@/lib/ranked/support-sync"
  );
  await syncConfiguredSupportUsers();
}
