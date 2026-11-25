import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { authenticate, createSession, destroySession, listMemberships, registerUser, resolveSession } from "@/server/services/identity";
import { createOrganization } from "@/server/services/organizations";

describe("identity", () => {
  it("registers, authenticates and manages sessions", async () => {
    const email = `${randomUUID()}@test.rentora.local`;
    await registerUser({ fullName: "Ana Kovač", email, password: "dolgo-geslo-123" });
    await expect(registerUser({ fullName: "Dup", email: email.toUpperCase(), password: "dolgo-geslo-123" })).rejects.toThrow(/auth.emailTaken/);
    await expect(authenticate({ email, password: "napacno-geslo" })).rejects.toThrow(/auth.invalidCredentials/);
    await expect(authenticate({ email: "nobody@x.si", password: "whatever" })).rejects.toThrow(/auth.invalidCredentials/);
    const user = await authenticate({ email, password: "dolgo-geslo-123" });
    const org = await createOrganization(user.id, { name: "Najem Kovač d.o.o." });
    expect(org.slug).toBe("najem-kovac-d-o-o");
    expect((await listMemberships(user.id))[0]).toMatchObject({ id: org.id, role: "owner" });
    const { token } = await createSession(user.id);
    const s = await resolveSession(token);
    expect(s?.user.email).toBe(email);
    expect(s?.activeOrgId).toBe(org.id);
    await destroySession(token);
    expect(await resolveSession(token)).toBeNull();
    expect(await resolveSession("forged-token")).toBeNull();
  });
});
