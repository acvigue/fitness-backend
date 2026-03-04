export type KeycloakTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

export type KeycloakSessionRaw = {
  id: string;
  username: string;
  userId: string;
  ipAddress: string;
  start: number;
  lastAccess: number;
  clients: Record<string, string>;
  transientUser: boolean;
  rememberMe: boolean;
};
