import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { getOrganization } from "@/server/services/organizations";
import { listMembers } from "@/server/services/members";
import { withPublic } from "@/server/db";
import { can, permissionsFor, ROLES } from "@/domain/permissions";
import { ActionForm, CheckboxField, Field, Submit } from "@/components/form";
import { fmtDate, Money, PageHeader, Panel } from "@/components/ui";
import { t } from "@/i18n";
import { addMemberAction, changeRoleAction, updateOrgAction } from "./actions";
import { AddMemberForm, RoleForm } from "./role-form";

export const metadata: Metadata = { title: "Nastavitve" };

export default async function SettingsPage() {
  const actor = await requireActor();
  const [org, members, plan] = await Promise.all([
    getOrganization(actor),
    listMembers(actor),
    withPublic((tx) => tx.query<{ code: string; name: string; price_month_cents: number; limits: { units: number; locations: number; members: number } }>("select code, name, price_month_cents, limits from subscription_plans")),
  ]);
  const current = plan.find((p) => p.code === org.plan_code)!;
  const manage = can(actor.role, "org.manage");
  const roles = ROLES.filter((r) => r !== "owner" || actor.role === "owner").map((r) => ({ value: r, label: t(`role.${r}`) }));
  return (
    <>
      <PageHeader title="Nastavitve" />
      <div className="grid gap-6 [&>*]:min-w-0 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Panel title="Podjetje">
            {manage ? (
              <ActionForm action={updateOrgAction} className="grid gap-4 sm:grid-cols-2">
                <Field name="name" label="Ime izposojevalnice" defaultValue={org.name} className="sm:col-span-2" />
                <Field name="legalName" label="Uradni naziv" defaultValue={org.legal_name ?? ""} />
                <Field name="taxId" label="Davčna številka" defaultValue={org.tax_id ?? ""} />
                <Field name="registrationNo" label="Matična številka" defaultValue={(org as { registration_no?: string }).registration_no ?? ""} />
                <Field name="phone" label="Telefon" type="tel" defaultValue={(org as { phone?: string }).phone ?? ""} hint="viden na QR nalepkah" />
                <Field name="email" label="E-pošta" type="email" defaultValue={(org as { email?: string }).email ?? ""} className="sm:col-span-2" />
                <div className="sm:col-span-2"><CheckboxField name="vatPayer" label="Zavezanec za DDV" defaultChecked={(org as { vat_payer?: boolean }).vat_payer ?? true} /></div>
                <div className="sm:col-span-2"><Submit>Shrani</Submit></div>
              </ActionForm>
            ) : <p className="text-sm text-steel">Podatke podjetja ureja lastnik.</p>}
          </Panel>
          <Panel title={`Sodelavci (${members.length})`} padded={false}>
            <ul className="divide-y divide-line">
              {members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{m.full_name}</p><p className="text-xs text-steel">{m.email}</p></div>
                  {can(actor.role, "members.manage") && m.user_id !== actor.userId ? (
                    <RoleForm action={changeRoleAction.bind(null, m.user_id)} role={m.role} roles={roles} />
                  ) : <span className="text-sm text-steel">{t(`role.${m.role}`)}</span>}
                </li>
              ))}
            </ul>
            {can(actor.role, "members.manage") && (
              <div className="border-t border-line p-4">
                <AddMemberForm action={addMemberAction} roles={roles} />
                <p className="mt-3 text-xs text-steel">Dodate lahko osebo, ki že ima račun RENTORA. Vabila po e-pošti bodo na voljo, ko bo povezan ponudnik e-pošte.</p>
              </div>
            )}
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel title="Paket">
            <p className="text-lg font-semibold">{current.name} <span className="text-sm font-normal text-steel"><Money cents={current.price_month_cents} /> / mesec</span></p>
            {org.trial_ends_at && <p className="mt-1 text-sm text-steel">Preizkus do {fmtDate(org.trial_ends_at)}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-steel">Enote</dt><dd className="text-right tabular">do {current.limits.units}</dd>
              <dt className="text-steel">Lokacije</dt><dd className="text-right tabular">do {current.limits.locations}</dd>
              <dt className="text-steel">Sodelavci</dt><dd className="text-right tabular">do {current.limits.members}</dd>
            </dl>
            <p className="mt-4 text-xs text-mute">Spletno plačevanje naročnine in menjava paketa bosta na voljo z modulom plačil (Stripe).</p>
          </Panel>
          <Panel title="Vaša dovoljenja">
            <p className="mb-2 text-sm">{t(`role.${actor.role}`)}</p>
            <p className="text-xs text-steel">{permissionsFor(actor.role).join(", ")}</p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
