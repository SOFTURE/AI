// The jobs adapter of @softure-ai/mailing: deliveries sent by the @softure-ai/jobs worker, with retries (an optional
// peer dependency; only apps that import this entry need it).
export {
  defineDeliveryJobHandler,
  enqueueDelivery,
  getDeliveryJobResult,
  type DeliveryJobContext,
  type DeliveryJobErrorCode,
  type DeliveryJobHandlerOptions,
  type DeliveryJobResult,
  type EnqueueDeliveryInput,
} from "./delivery-job.js";
