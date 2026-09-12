import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAppServices } from "../app.js";
import { createMcpServer } from "./server.js";

const services = createAppServices();
const server = createMcpServer(services);
const transport = new StdioServerTransport();
await server.connect(transport);
