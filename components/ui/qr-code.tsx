import qrcode from "qrcode-generator";

/**
 * QR code généré LOCALEMENT (SVG), sans service tiers. Le catalogue
 * imprimable appelait api.qrserver.com : l'URL de la boutique partait chez un
 * tiers et l'image était bloquée par la politique de sécurité du site.
 * Même principe que l'app (catalog_qr_generator.dart) et que le QR de
 * réservation hôtelière (référence seule, §1.11).
 *
 * Le SVG est construit à partir des modules du code (carrés noirs/blancs) :
 * le texte encodé n'y figure jamais tel quel, d'où l'injection sans risque.
 */
export function QrCode({
  value,
  size = 150,
  className,
  title,
}: {
  value: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const svg = qr.createSvgTag({ margin: 2, scalable: true });
  return (
    <span
      role="img"
      aria-label={title ?? "QR code"}
      className={className}
      style={{ display: "inline-block", width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
