const sites = [
  ['Lala', 'https://lala.kobeapptz.com/'],
  ['Jumla', 'https://jumla.kobeapptz.com/'],
  ['CargoTZ', 'https://cargotz.kobeapptz.com/cargotz/board'],
  ['CargoTZ parcel tracking', 'https://cargotz.kobeapptz.com/ctz'],
  ['Mzigo', 'https://mzigo.kobeapptz.com/'],
  ['Cargo tracking', 'https://track.kobeapptz.com/'],
  ['Tuma', 'https://tuma.kobeapptz.com/'],
  ['Customer portal', 'https://me.kobeapptz.com/'],
  ['POSys', 'https://posys.kobeapptz.com/'],
  ['Property', 'https://property.kobeapptz.com/'],
  ['Tenant portal', 'https://estate.kobeapptz.com/'],
  ['Rent collection', 'https://pay.kobeapptz.com/'],
  ['Contracts', 'https://contract.kobeapptz.com/'],
  ['Kobe Coach', '/coach'],
  ['KobeOS Transit', '/transit'],
];

export default function OnlineApps({ store }: { store: string | null }) {
  const tenant = store || new URLSearchParams(window.location.search).get('store');
  const slug = tenant && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenant) ? tenant : null;
  const apex = 'https://kobeapptz.com';
  const workspace = slug ? [
    ['Storefront', apex + '/shop/' + slug],
    ['Staff workspace', apex + '/m/' + slug],
  ] : [];
  return <main data-surface="light" className="min-h-dvh bg-slate-100 px-4 py-10 text-slate-900">
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-black">KobeOS online apps</h1>
      {slug && <h2 className="mt-5 text-lg font-bold capitalize">{slug}</h2>}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...workspace, ...sites].map(([name, url]) => <li key={name}>
          <a className="block rounded-xl border border-slate-200 bg-white px-4 py-4 font-semibold text-slate-900 hover:border-blue-500" href={new URL(url, apex).href}>{name}</a>
        </li>)}
      </ul>
    </div>
  </main>;
}
