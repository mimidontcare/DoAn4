import { Prisma } from '@prisma/client';
import { PUBLIC_USER_SELECT, PublicUser } from '../users/user.select';

export const STAFF_SELECT = {
  ...PUBLIC_USER_SELECT,
  staffZones: {
    orderBy: { zoneId: 'asc' },
    select: {
      zone: {
        select: { id: true, name: true, isActive: true, provinceId: true },
      },
    },
  },
} satisfies Prisma.UserSelect;

type StaffRow = Prisma.UserGetPayload<{ select: typeof STAFF_SELECT }>;

export interface StaffView extends PublicUser {
  zones: StaffRow['staffZones'][number]['zone'][];
}

export function toStaffView(row: StaffRow): StaffView {
  const { staffZones, ...user } = row;
  return { ...user, zones: staffZones.map((sz) => sz.zone) };
}

export const UNAVAILABILITY_SELECT = {
  id: true,
  startAt: true,
  endAt: true,
  reason: true,
  createdAt: true,
  creator: { select: { id: true, fullName: true } },
} satisfies Prisma.StaffUnavailabilitySelect;

export type UnavailabilityView = Prisma.StaffUnavailabilityGetPayload<{
  select: typeof UNAVAILABILITY_SELECT;
}>;
