export type ProvisionHandoff = {
  soulMd: string;
  tokens: {
    botRegistrationId: string;
    messagingToken: string;
    webhookSecret: string;
  };
  /** CLI command the user runs locally to link the daemon to this agent. */
  linkCommand: string;
};
