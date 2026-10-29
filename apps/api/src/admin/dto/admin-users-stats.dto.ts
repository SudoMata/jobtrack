/** Platform-wide user figures. */
export class AdminUsersStatsDto {
  total!: number;
  active!: number;
  suspended!: number;

  /** Accounts created during the requested period. */
  newUsers!: number;
}
