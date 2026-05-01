export type AgentRole = "user" | "assistant";

export interface AgentChatMessage {
  role: AgentRole;
  content: string;
}

export interface AgentChatRequest {
  messages: AgentChatMessage[];
}

export type AgentToolName = "maps_to" | "send_email" | "update_site_style";

export interface MapsToArgs {
  page_name: string;
}

export interface SendEmailArgs {
  recipient: string;
  body: string;
}

export interface UpdateSiteStyleArgs {
  property: string;
  value: string;
}

export type AgentToolArgs = MapsToArgs | SendEmailArgs | UpdateSiteStyleArgs;

export interface AgentToolCall {
  id: string;
  name: AgentToolName;
  arguments: AgentToolArgs;
}

export interface AgentChatResponse {
  assistantMessage: string;
  toolCalls: AgentToolCall[];
}

export interface messengerChatResponse {
  assistantMessage: string;
}
