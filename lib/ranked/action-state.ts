export interface AuthActionState {
  readonly status: "idle" | "success" | "error";
  readonly message?: string;
}

export type AccountActionState = AuthActionState;

export const INITIAL_AUTH_ACTION_STATE: AuthActionState = { status: "idle" };
export const INITIAL_ACCOUNT_ACTION_STATE: AccountActionState = {
  status: "idle",
};
