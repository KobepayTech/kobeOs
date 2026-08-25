import MetaSetupPanel from './MetaSetupPanel';

export default function MetaSetupPage({ token }: { token: string }) {
  return (
    <main className="min-h-screen overflow-y-auto bg-[#0f172a] px-4 py-8 text-os-text-primary">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-os-accent text-white font-black">K</div>
          <div>
            <p className="font-semibold">KobeOS secure setup</p>
            <p className="text-xs text-os-text-muted">Meta sign-in activation</p>
          </div>
        </div>
        <MetaSetupPanel token={token} />
      </div>
    </main>
  );
}
