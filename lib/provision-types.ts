export type ProvisionHandoff = {
  soulMd: string;
  tokens: {
    botRegistrationId: string;
    messagingToken: string;
    webhookSecret: string;
  };
  dockerCommand: string;
};
