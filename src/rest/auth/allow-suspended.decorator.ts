import { SetMetadata } from '@nestjs/common';

export const ALLOW_SUSPENDED_KEY = 'allowSuspended';
/**
 * Allow suspended/banned authenticated users to reach this endpoint. Bearer
 * token is still required and verified; only the suspension/ban gate is
 * skipped. Use sparingly — currently only for the account-status endpoint
 * the frontend polls to render an "account suspended" banner.
 */
export const AllowSuspended = () => SetMetadata(ALLOW_SUSPENDED_KEY, true);
