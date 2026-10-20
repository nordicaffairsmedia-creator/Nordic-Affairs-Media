'use server'

import { headers } from 'next/headers'
import { requireStaff } from '@/lib/staff'
import { abortUnfinished, checkStorage, fixCors, listUnfinished, removeTestObject, testUploadUrl } from '@/lib/storage'

/** The address the person is using right now, e.g. https://frontend-nordic-affairs-media.vercel.app */
async function currentOrigin() {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return host ? `${proto}://${host}` : ''
}

// SuperAdmin only (requireStaff() with no roles).
export async function runStorageCheck() {
  await requireStaff()
  return { ...(await checkStorage(await currentOrigin())), origin: await currentOrigin() }
}

export async function fixStorageCors() {
  await requireStaff()
  return fixCors(await currentOrigin())
}

export async function browserTestTarget() {
  await requireStaff()
  return testUploadUrl()
}

export async function cleanupTest(key: string) {
  await requireStaff()
  await removeTestObject(key)
}

export async function listUnfinishedUploads() {
  await requireStaff()
  return listUnfinished()
}

/** Cancels half-finished uploads that started more than 30 minutes ago and frees the space they hold. */
export async function cleanUnfinishedUploads() {
  await requireStaff()
  return abortUnfinished(30)
}
