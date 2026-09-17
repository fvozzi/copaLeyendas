import type { RegistrationAccessGrant } from '../types';
import { formatRegistrationDate } from '../lib/registration-dates';

const labels = { accepted: 'Aceptado', sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Fallido' };

export function WhatsAppDeliveryStatus({ grant }: { grant: RegistrationAccessGrant }) {
  const delivery = grant.whatsappDelivery;
  if (!delivery && !grant.whatsappSentAt) return <>Sin envío registrado</>;
  const status = delivery?.status ?? 'accepted';
  return <div className={`whatsapp-delivery whatsapp-delivery-${status}`}>
    <span className={`status-chip ${status === 'delivered' || status === 'read' ? 'status-live' : 'status-review'}`}>{labels[status]}</span>
    {delivery && <small className="admin-grid-detail">{formatRegistrationDate(delivery.statusAt)}</small>}
    {(status === 'accepted' || status === 'sent') && <small className="admin-grid-detail">Sin confirmación de entrega</small>}
    {status === 'failed' && <small className="admin-grid-detail">{delivery?.errorCode != null ? `Error ${delivery.errorCode}: ` : ''}{delivery?.errorMessage || 'Meta informó que no pudo entregar el mensaje.'}</small>}
  </div>;
}
