import { redirect } from 'next/navigation'
import { getStaffUser } from '@/lib/staff'
import { loginAction } from '../actions'
import { PasswordInput } from '@/components/forms/PasswordInput'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign in' }

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const user = await getStaffUser()
  if (user && !sp.denied) redirect('/staff')
  const input =
    'min-h-[52px] w-full rounded-xl border border-white/10 bg-[#1c1c1e] px-4 text-[17px] text-white placeholder:text-[#6e6e73] transition-[border-color,box-shadow] focus:border-[#0a84ff] focus:shadow-[0_0_0_4px_rgba(10,132,255,0.25)] focus:outline-none'
  return (
    <main className="staff-ui relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-black px-5 py-12 text-[#f5f5f7]">
      {/* A single soft light behind the form, nothing else. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-30%] left-1/2 h-[70vh] w-[90vw] max-w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(41,151,255,0.16),transparent)]"
      />
      <div className="staff-rise relative w-full max-w-[380px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/nam-logo-gold-480.png"
          alt="Nordic Affairs Media"
          width={480}
          height={327}
          className="mx-auto h-14 w-auto"
        />
        <h1 className="mt-10 text-center text-[32px] leading-tight font-semibold tracking-[-0.03em]">
          Sign in to Staff
        </h1>
        <p className="mt-2 text-center text-[15px] text-[#86868b]">Events, tickets, gate and reports.</p>
        {sp.failed ? (
          <p className="mt-6 rounded-xl bg-[#ff453a]/12 px-4 py-3 text-center text-[14px] text-[#ff8a80]">
            Username or password is not right.
          </p>
        ) : null}
        {sp.denied ? (
          <p className="mt-6 rounded-xl bg-[#ff9f0a]/12 px-4 py-3 text-center text-[14px] text-[#ffb340]">
            Your account does not have access to this page. Ask the owner to add the right role.
          </p>
        ) : null}
        <form action={loginAction} className="mt-8 space-y-3">
          <label className="block">
            <span className="sr-only">Username or email</span>
            <input name="login" type="text" required autoComplete="username" autoCapitalize="none" placeholder="Username or email" className={input} />
          </label>
          <label className="block">
            <span className="sr-only">Password</span>
            <PasswordInput name="password" required autoComplete="current-password" placeholder="Password" className={input} />
          </label>
          <button
            type="submit"
            className="mt-3 min-h-[52px] w-full rounded-xl bg-[#0a84ff] text-[17px] font-medium text-white transition-[background-color,transform] hover:bg-[#2997ff] active:scale-[0.99]"
          >
            Continue
          </button>
        </form>
        <p className="mt-8 text-center text-[12px] leading-relaxed text-[#6e6e73]">
          Same account as the content manager. Gate staff accounts are created by the owner under Settings → Users.
        </p>
      </div>
      <p className="absolute bottom-6 text-[12px] text-[#48484a]">© Nordic Affairs Media · Stockholm</p>
    </main>
  )
}
