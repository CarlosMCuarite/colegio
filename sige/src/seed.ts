// src/seed.ts — SIGE V8.1 — Solo crea SuperAdministrador
import 'dotenv/config';
import prisma from './config/prisma';
import { supabaseAdmin } from './config/supabase';
import { RolNombre } from '@prisma/client';

async function main() {
  console.log('🌱 Seed V8.1 — Solo SuperAdministrador...');
  const EMAIL    = process.env.SEED_SUPERADMIN_EMAIL    || 'carce240201@gmail.com';
  const PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD || '75764047';
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  const existing = listData?.users?.find((u: any) => u.email === EMAIL);
  let supabaseId: string;
  if (existing) {
    supabaseId = existing.id;
    await supabaseAdmin.auth.admin.updateUserById(supabaseId, { password: PASSWORD, email_confirm: true });
    console.log('✅ SuperAdmin actualizado:', EMAIL);
  } else {
    const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
    if (error) throw new Error(`Error creando superadmin: ${error.message}`);
    supabaseId = authData.user.id;
    console.log('✅ SuperAdmin creado:', EMAIL);
  }
  await prisma.usuario.upsert({
    where:  { supabaseId },
    update: { email: EMAIL },
    create: { supabaseId, colegioId: null, rol: RolNombre.SUPERADMIN, nombres: 'Super', apellidos: 'Administrador', email: EMAIL },
  });
  console.log('\n🎉 Seed completado — SuperAdmin:', EMAIL, '/', PASSWORD);
}
main().catch(console.error).finally(() => prisma.$disconnect());
