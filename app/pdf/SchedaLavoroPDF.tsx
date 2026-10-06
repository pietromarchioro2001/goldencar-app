import React from "react";



import {



  Document,



  Page,



  View,



  Text,



  Image,



  Svg,



  G,



  Path,



  StyleSheet,



} from "@react-pdf/renderer";







export type SchedaLavoroPDFData = {



  nomeCliente: string;



  indirizzo: string;



  telefono: string;



  codiceFiscale: string;



  veicolo: string;



  targa: string;



  kilometers: string;







  jobNumber: number;



  createdAt: string;



  labor: string;







  workType?: string;

  problems: string[];



  works: string;



  notes: string;



  invoiceNumber: string;







  products: {



    name: string;



    details: string;



    quantity?: string;



    orderRequested?: boolean;



  }[];







  status?: "IN_LAVORAZIONE" | "CONCLUSO";



};







type Props = {



  lavoro: SchedaLavoroPDFData;



};







/* =========================================================



   COLORI



\========================================================= */







const NAVY = "#102A43";



const DARK_NAVY = "#041E49";



const GOLD = "#D4AF37";



const GOLD_DARK = "#C99B2E";



const LIGHT_BLUE = "#EEF3F8";



const BORDER = "#C9D5E2";



const TEXT = "#1F2937";



const MUTED = "#64748B";







/* =========================================================



   STILI



\========================================================= */







const styles = StyleSheet.create({



  page: {



    size: "A4",



    paddingTop: 18,



    paddingBottom: 18,



    paddingHorizontal: 24,



    backgroundColor: "#FFFFFF",



    fontFamily: "Helvetica",



    color: DARK_NAVY,



  },







  /* ---------- HEADER ---------- */







  header: {



    flexDirection: "row",



    justifyContent: "space-between",



    alignItems: "flex-start",



    marginBottom: 8,



  },







  company: {



    width: "56%",



  },







  brandRow: {



    flexDirection: "row",



    alignItems: "center",



    marginBottom: 3,



  },







  logo: {



    width: 40,



    height: 40,



    objectFit: "contain",



    marginRight: 7,



  },







  logoDivider: {



    width: 1,



    height: 35,



    backgroundColor: GOLD,



    marginRight: 7,



  },







  brandName: {



    fontSize: 19,



    fontWeight: 800,



    color: DARK_NAVY,



  },







  brandGold: {



    color: GOLD_DARK,



  },







  owner: {



    fontSize: 7.5,



    marginTop: 2,



    color: "#374151",



  },







  companyDetails: {



    fontSize: 7,



    lineHeight: 1.42,



    color: "#374151",



  },







  workBox: {



    width: "38%",



    backgroundColor: LIGHT_BLUE,



    borderRadius: 9,



    padding: 7,



    borderLeftWidth: 5,



    borderLeftColor: GOLD,



  },







  workTitle: {



    fontSize: 14,



    fontWeight: 800,



    color: DARK_NAVY,



    paddingBottom: 6,



    marginBottom: 4,



    borderBottomWidth: 1,



    borderBottomColor: GOLD,



  },







  workRow: {



    flexDirection: "row",



    marginBottom: 2,



  },







  workLabel: {



    width: "48%",



    fontSize: 7,



    fontWeight: 800,



    color: DARK_NAVY,



  },







  workValue: {



    width: "52%",



    fontSize: 7,



    color: TEXT,



  },







  divider: {



    height: 2,



    backgroundColor: GOLD,



    marginBottom: 4,



  },







  /* ---------- CLIENTE / VEICOLO ---------- */







  infoRow: {



    flexDirection: "row",



    marginBottom: 4,



  },







  infoCard: {



    flex: 1,



    borderWidth: 1,



    borderColor: BORDER,



    borderRadius: 9,



    overflow: "hidden",



  },







  infoCardLeft: {



    marginRight: 6,



  },







  infoCardRight: {



    marginLeft: 6,



  },







  infoHeader: {



    flexDirection: "row",



    alignItems: "center",



    backgroundColor: NAVY,



    minHeight: 23,



  },







  iconBlock: {



    width: 28,



    height: 23,



    backgroundColor: GOLD_DARK,



    alignItems: "center",



    justifyContent: "center",



  },







  infoTitle: {



    fontSize: 7.5,



    fontWeight: 800,



    color: "#FFFFFF",



    marginLeft: 6,



  },







  infoBody: {



    padding: 6,



  },







  clientName: {



    fontSize: 10,



    fontWeight: 800,



    color: DARK_NAVY,



    marginBottom: 4,



  },







  infoLine: {



    fontSize: 7.5,



    color: TEXT,



    marginBottom: 3,



    lineHeight: 1.15,



  },







  /* ---------- SEZIONI ---------- */







  section: {



    borderWidth: 1,



    borderColor: BORDER,



    borderRadius: 9,



    overflow: "hidden",



    marginBottom: 6,



  },







  sectionHeader: {



    flexDirection: "row",



    alignItems: "center",



    backgroundColor: LIGHT_BLUE,



    minHeight: 23,



  },







  sectionIcon: {



    width: 28,



    height: 23,



    backgroundColor: GOLD_DARK,



    alignItems: "center",



    justifyContent: "center",



  },







  sectionTitle: {



    fontSize: 7.5,



    fontWeight: 800,



    color: DARK_NAVY,



    marginLeft: 6,



  },







  sectionBody: {



    padding: 6,



  },







  bulletRow: {



    flexDirection: "row",



    marginBottom: 4,



  },







  bullet: {



    width: 10,



    fontSize: 7.5,



    fontWeight: 800,



    color: DARK_NAVY,



  },







  bulletText: {



    flex: 1,



    fontSize: 7.5,



    color: TEXT,



    lineHeight: 1.2,



  },







  emptyText: {



    fontSize: 7.5,



    color: MUTED,



  },







  /* ---------- PRODOTTI ---------- */







  productRow: {



    flexDirection: "row",



    marginBottom: 3,



  },







  productBullet: {



    width: 10,



    fontSize: 7.5,



    fontWeight: 800,



    color: DARK_NAVY,



  },







  productContent: {



    flex: 1,



  },







  productName: {



    fontSize: 7.5,



    color: TEXT,



    lineHeight: 1.3,



  },







  productDetails: {



    fontSize: 7,



    color: MUTED,



    marginTop: 0,



  },







  /* ---------- NOTE / FATTURA ---------- */







  bottomRow: {



    flexDirection: "row",



    marginBottom: 6,



  },



  compactRow: {

    flexDirection: "row",

    marginBottom: 6,

  },



  compactSection: {

    flex: 1,

  },



  compactLeft: {

    marginRight: 6,

  },



  compactRight: {

    marginLeft: 6,

  },



  compactBody: {

    minHeight: 30,

  },







  halfSection: {



    flex: 1,



  },







  halfLeft: {



    marginRight: 6,



  },







  halfRight: {



    marginLeft: 6,



  },







  notesBody: {



    minHeight: 32,



  },







  invoiceBody: {



    minHeight: 32,



  },







  invoiceNumber: {



    fontSize: 12,



    fontWeight: 700,



    color: DARK_NAVY,



  },







  /* ---------- FIRME ---------- */







  signatures: {



    flexDirection: "row",



  },







  signatureBox: {



    flex: 1,



    borderWidth: 1,



    borderColor: BORDER,



    borderRadius: 9,



    minHeight: 30,



    padding: 6,



  },







  signatureLeft: {



    marginRight: 6,



  },







  signatureRight: {



    marginLeft: 6,



  },







  signatureTitleRow: {



    flexDirection: "row",



    alignItems: "center",



  },







  signatureTitle: {



    fontSize: 7,



    fontWeight: 800,



    color: DARK_NAVY,



    marginLeft: 5,



  },







  signatureLine: {



    borderBottomWidth: 1,



    borderBottomColor: DARK_NAVY,



    marginTop: 17,



    marginHorizontal: 5,



  },



});







/* =========================================================



   ICONS SVG



\========================================================= */







function PersonIcon() {



  return (



    <Svg width={18} height={18} viewBox="0 0 24 24">



      <Path



        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"



        fill="none"



        stroke="#FFFFFF"



        strokeWidth={2}



        strokeLinecap="round"



        strokeLinejoin="round"



      />



    </Svg>



  );



}







function CarIcon() {



  return (



    <Svg width={19} height={19} viewBox="0 0 24 24">



      <G



        stroke="#FFFFFF"



        strokeWidth={1.8}



        strokeLinecap="round"



        strokeLinejoin="round"



        fill="none"



      >



        <Path d="M2 9L4 10L5.3 6.2C5.8 4.8 6.3 4 8.3 4H15.7C17.7 4 18.2 4.8 18.7 6.2L20 10L22 9" />



        <Path d="M6.8 10H17.2C20 10 22 11.4 22 14.8V17.5C22 18.9 20.9 20 19.5 20H19C17.9 20 17 19.1 17 18C17 17.7 16.8 17.5 16.5 17.5H7.5C7.2 17.5 7 17.7 7 18C7 19.1 6.1 20 5 20H4.5C3.1 20 2 18.9 2 17.5V14.8C2 11.4 4 10 6.8 10Z" />



      </G>



    </Svg>



  );



}







function WrenchIcon() {



  return (



    <Svg width={18} height={18} viewBox="0 0 640 640">



      <Path



        d="M320 64C334.7 64 348.2 72.1 355.2 85L571.2 485C577.9 497.4 577.6 512.4 570.4 524.5C563.2 536.6 550.1 544 536 544L104 544C89.9 544 76.8 536.6 69.6 524.5C62.4 512.4 62.1 497.4 68.8 485L284.8 85C291.8 72.1 305.3 64 320 64zM320 416C302.3 416 288 430.3 288 448C288 465.7 302.3 480 320 480C337.7 480 352 465.7 352 448C352 430.3 337.7 416 320 416zM320 224C301.8 224 287.3 239.5 288.6 257.7L296 361.7C296.9 374.2 307.4 384 319.9 384C332.5 384 342.9 374.3 343.8 361.7L351.2 257.7C352.5 239.5 338.1 224 319.8 224z"



        fill="#FFFFFF"



      />



    </Svg>



  );



}







function CarInspectionIcon() {
  return (
    <Svg width={21} height={15} viewBox="0 0 122.88 87">
      <Path
        d="M9 30.31C-.72 25.37.4 19.86 10.17 20.44l2.18 4.1 4.51-14C18.63 5 21.58 0 27.37 0H85c5.78 0 9.11 4.91 10.51 10.51l3.38 13.6 2-3.67c10-.59 10.93 5.24.34 10.27a27.13 27.13 0 0 0-4.4-1.27 28.47 28.47 0 0 0-5.46-.54 27.67 27.67 0 0 0-5.45.54 27.09 27.09 0 0 0-5.3 1.63 27.92 27.92 0 0 0-4.86 2.6 28.6 28.6 0 0 0-4.28 3.47A28 28 0 0 0 68 41.42a27.91 27.91 0 0 0-4.23 21.07 28.46 28.46 0 0 0 1.4 4.74l.22.57c.12.29.24.57.37.86H21.29V71.3A3.3 3.3 0 0 1 18 74.58H4A3.3 3.3 0 0 1 .7 71.3v-7.58a4.38 4.38 0 0 1 0-.51C-.33 49.6-1.82 37.33 9 30.31Zm85.9 6A22.27 22.27 0 0 1 114 70.05l8.62 9.39a1.07 1.07 0 0 1-.06 1.51l-6.33 5.77a1.06 1.06 0 0 1-1.5-.06l-8.25-9.07a22 22 0 0 1-5.11 2.29 22.44 22.44 0 0 1-6.44 1 22.12 22.12 0 0 1-8.51-1.69 22.43 22.43 0 0 1-7.23-4.83l-.06-.06a22.41 22.41 0 0 1-4.78-7.17A22.26 22.26 0 0 1 94.91 36.31ZM107.47 46a17.83 17.83 0 0 0-5.77-3.86l-.06-.02a17.67 17.67 0 0 0-6.73-1.32A17.63 17.63 0 0 0 82.35 46a17.62 17.62 0 0 0-3.86 5.77l-.02.04A17.78 17.78 0 0 0 101.7 75a18.15 18.15 0 0 0 5.77-3.86 17.8 17.8 0 0 0 3.86-19.35A17.93 17.93 0 0 0 107.47 46ZM26.9 46.45l-12.45-1.56c-2.94-.33-3.73.91-2.72 3.44l1.34 3.27a4.84 4.84 0 0 0 1.68 1.88 5.86 5.86 0 0 0 2.79.77l11.11.09c2.68 0 3.84-1.08 3-3.55a6 6 0 0 0-4.75-4.33ZM17 27.63h76.92l-3.4-14.1c-.93-4.29-3.6-8-8-8H29.28c-4.4 0-6.66 3.81-8 8L17 27.63Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

function GearIcon() {



  return (



    <Svg width={18} height={18} viewBox="0 0 24 24">



      <Path



        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"



        fill="none"



        stroke="#FFFFFF"



        strokeWidth={1.8}



      />



      <Path



        d="M19 13.5v-3l-2-.5a7 7 0 0 0-.8-1.8l1.1-1.7-2.1-2.1-1.7 1.1a7 7 0 0 0-1.8-.8l-.5-2h-3l-.5 2a7 7 0 0 0-1.8.8L4.2 4.3 2.1 6.4l1.1 1.7a7 7 0 0 0-.8 1.8l-2 .5v3l2 .5a7 7 0 0 0 .8 1.8l-1.1 1.7 2.1 2.1 1.7-1.1a7 7 0 0 0 1.8.8l.5 2h3l.5-2a7 7 0 0 0 1.8-.8l1.7 1.1 2.1-2.1-1.1-1.7a7 7 0 0 0 .8-1.8l2-.5Z"



        fill="none"



        stroke="#FFFFFF"



        strokeWidth={1.5}



        strokeLinejoin="round"



      />



    </Svg>



  );



}







function PackageIcon() {



  return (



    <Svg width={18} height={18} viewBox="0 0 24 24">



      <Path



        d="m4 8.5 8-4.5 8 4.5v7L12 20l-8-4.5v-7Z"



        fill="none"



        stroke="#FFFFFF"



        strokeWidth={1.7}



        strokeLinejoin="round"



      />



      <Path



        d="m4.5 8.5 7.5 4.5 7.5-4.5M12 13v7"



        fill="none"



        stroke="#FFFFFF"



        strokeWidth={1.7}



        strokeLinejoin="round"



      />



    </Svg>



  );



}







function NoteIcon() {



  return (



    <Svg width={18} height={18} viewBox="0 0 640 640">



      <Path



        d="M128 128C92.7 128 64 156.7 64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192C576 156.7 547.3 128 512 128L128 128zM224 384C224 401.7 209.7 416 192 416C174.3 416 160 401.7 160 384C160 366.3 174.3 352 192 352C209.7 352 224 366.3 224 384zM192 288C174.3 288 160 273.7 160 256C160 238.3 174.3 224 192 224C209.7 224 224 238.3 224 256C224 273.7 209.7 288 192 288zM312 232L456 232C469.3 232 480 242.7 480 256C480 269.3 469.3 280 456 280L312 280C298.7 280 288 269.3 288 256C288 242.7 298.7 232 312 232zM312 360L456 360C469.3 360 480 370.7 480 384C480 397.3 469.3 408 456 408L312 408C298.7 408 288 397.3 288 384C288 370.7 298.7 360 312 360z"



        fill="#FFFFFF"



      />



    </Svg>



  );



}







function InvoiceIcon() {



  return (



    <Svg width={18} height={18} viewBox="0 0 640 640">



      <Path



        d="M142 66.2C150.5 62.3 160.5 63.7 167.6 69.8L208 104.4L248.4 69.8C257.4 62.1 270.7 62.1 279.6 69.8L320 104.4L360.4 69.8C369.4 62.1 382.6 62.1 391.6 69.8L432 104.4L472.4 69.8C479.5 63.7 489.5 62.3 498 66.2C506.5 70.1 512 78.6 512 88L512 552C512 561.4 506.5 569.9 498 573.8C489.5 577.7 479.5 576.3 472.4 570.2L432 535.6L391.6 570.2C382.6 577.9 369.4 577.9 360.4 570.2L320 535.6L279.6 570.2C270.6 577.9 257.3 577.9 248.4 570.2L208 535.6L167.6 570.2C160.5 576.3 150.5 577.7 142 573.8C133.5 569.9 128 561.4 128 552L128 88C128 78.6 133.5 70.1 142 66.2zM232 200C218.7 200 208 210.7 208 224C208 237.3 218.7 248 232 248L408 248C421.3 248 432 237.3 432 224C432 210.7 421.3 200 408 200L232 200zM208 416C208 429.3 218.7 440 232 440L408 440C421.3 440 432 429.3 432 416C432 402.7 421.3 392 408 392L232 392C218.7 392 208 402.7 208 416zM232 296C218.7 296 208 306.7 208 320C208 333.3 218.7 344 232 344L408 344C421.3 344 432 333.3 432 320C432 306.7 421.3 296 408 296L232 296z"



        fill="#FFFFFF"



      />



    </Svg>



  );



}







function PencilIcon() {



  return (



    <Svg width={17} height={17} viewBox="0 0 24 24">



      <Path



        d="m4 20 4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20Z"



        fill="none"



        stroke={DARK_NAVY}



        strokeWidth={1.8}



        strokeLinejoin="round"



      />



      <Path



        d="m13.5 6.5 4 4"



        stroke={DARK_NAVY}



        strokeWidth={1.8}



      />



    </Svg>



  );



}







/* =========================================================



   COMPONENTI SEZIONI



\========================================================= */







function SectionHeader({



  title,



  icon,



}: {



  title: string;



  icon: React.ReactNode;



}) {



  return (



    <View style={styles.sectionHeader}>



      <View style={styles.sectionIcon}>{icon}</View>



      <Text style={styles.sectionTitle}>{title}</Text>



    </View>



  );



}







function TextListSection({



  title,



  icon,



  items,



}: {



  title: string;



  icon: React.ReactNode;



  items: string[];



}) {



  const cleanItems = items



    .map((item) => item.trim())



    .filter(Boolean);







  if (!cleanItems.length) return null;







  return (



    <View style={styles.section}>



      <SectionHeader title={title} icon={icon} />







      <View style={styles.sectionBody}>



        {cleanItems.map((item, index) => (



          <View style={styles.bulletRow} key={`${item}-${index}`}>



            <Text style={styles.bullet}>•</Text>



            <Text style={styles.bulletText}>{item}</Text>



          </View>



        ))}



      </View>



    </View>



  );



}







function ProductsSection({



  products,



}: {



  products: SchedaLavoroPDFData["products"];



}) {



  const cleanProducts = products.filter(



    (product) => product.name.trim()



  );







  if (!cleanProducts.length) return null;







  return (



    <View style={styles.section}>



      <SectionHeader



        title="PRODOTTI UTILIZZATI"



        icon={<PackageIcon />}



      />







      <View style={styles.sectionBody}>



        {cleanProducts.map((product, index) => (



          <View



            style={styles.productRow}



            key={`${product.name}-${index}`}



          >



            <Text style={styles.productBullet}>•</Text>







            <View style={styles.productContent}>



              <Text style={styles.productName}>



                {product.name}



                {product.quantity



                  ? ` × ${product.quantity}`



                  : ""}



              </Text>







              {product.details.trim() && (



                <Text style={styles.productDetails}>



                  {product.details}



                </Text>



              )}



            </View>



          </View>



        ))}



      </View>



    </View>



  );



}







/* =========================================================



   HELPERS



\========================================================= */







function formatDate(value: string) {



  const date = new Date(value);







  if (Number.isNaN(date.getTime())) {



    return value || "—";



  }







  return new Intl.DateTimeFormat("it-IT", {



    day: "2-digit",



    month: "2-digit",



    year: "numeric",



  }).format(date);



}







/* =========================================================



   PDF



\========================================================= */







export default function SchedaLavoroPDF({ lavoro }: Props) {



  const problems = lavoro.problems



    .map((item) => item.trim())



    .filter(Boolean);







  const works = lavoro.works.trim();







  return (



    <Document



      title={`Scheda lavoro ${lavoro.jobNumber}`}



      author="GOLDENCAR - di Marchioro Michele"



      subject="Scheda lavoro officina"



    >



      <Page size="A4" style={styles.page}>







        {/* =================================================



            INTESTAZIONE



        ================================================= */}







        <View style={styles.header}>







          <View style={styles.company}>







            <View style={styles.brandRow}>







              {/* Il logo verrà aggiunto in public/logo-goldencar.png */}



              <Image



                src="/logo-goldencar.png"



                style={styles.logo}



              />







              <View style={styles.logoDivider} />







              <View>



                <Text style={styles.brandName}>



                  GOLDEN



                  <Text style={styles.brandGold}>CAR</Text>



                </Text>







                <Text style={styles.owner}>



                  di Marchioro Michele



                </Text>



              </View>







            </View>







            <Text style={styles.companyDetails}>



              Via Roma 18{"\n"}



              38011 Cavareno (TN){"\n"}



              Partita IVA: 01665250229{"\n"}



              Cod. fiscale: MRCMHL70D21L736W{"\n"}



              Tel.: +39 3407050353{"\n"}



              E-mail: michele.marchior1970@gmail.com



            </Text>







          </View>







          <View style={styles.workBox}>







            <Text style={styles.workTitle}>



              SCHEDA LAVORO



            </Text>







            <View style={styles.workRow}>



              <Text style={styles.workLabel}>DATA</Text>



              <Text style={styles.workValue}>



                {formatDate(lavoro.createdAt)}



              </Text>



            </View>







            <View style={styles.workRow}>



              <Text style={styles.workLabel}>N. SCHEDA</Text>



              <Text style={styles.workValue}>



                {lavoro.jobNumber}



              </Text>



            </View>







            <View style={styles.workRow}>



              <Text style={styles.workLabel}>INCARICATO</Text>



              <Text style={styles.workValue}>



                STEFANO GRITTI



              </Text>



            </View>







            <View style={styles.workRow}>



              <Text style={styles.workLabel}>MANODOPERA</Text>



              <Text style={styles.workValue}>



                {lavoro.labor || "—"}



              </Text>



            </View>







          </View>







        </View>







        <View style={styles.divider} />







        {/* =================================================



            CLIENTE / VEICOLO



        ================================================= */}







        <View style={styles.infoRow}>







          <View



            style={[



              styles.infoCard,



              styles.infoCardLeft,



            ]}



          >



            <View style={styles.infoHeader}>



              <View style={styles.iconBlock}>



                <PersonIcon />



              </View>







              <Text style={styles.infoTitle}>



                CLIENTE



              </Text>



            </View>







            <View style={styles.infoBody}>







              <Text style={styles.clientName}>



                {lavoro.nomeCliente || "—"}



              </Text>







              <Text style={styles.infoLine}>



                {lavoro.indirizzo || "—"}



              </Text>







              <Text style={styles.infoLine}>



                {lavoro.telefono || "—"}



              </Text>







              {/* stesso stile del telefono */}



              <Text style={styles.infoLine}>



                {lavoro.codiceFiscale || "—"}



              </Text>







            </View>



          </View>







          <View



            style={[



              styles.infoCard,



              styles.infoCardRight,



            ]}



          >



            <View style={styles.infoHeader}>



              <View style={styles.iconBlock}>



                <CarIcon />



              </View>







              <Text style={styles.infoTitle}>



                VEICOLO



              </Text>



            </View>







            <View style={styles.infoBody}>







              <Text style={styles.clientName}>



                {lavoro.veicolo || "—"}



              </Text>







              {/* stesso stile del telefono */}



              <Text style={styles.infoLine}>



                {lavoro.targa || "—"}



              </Text>







              <Text style={styles.infoLine}>



                {lavoro.kilometers



                  ? `${lavoro.kilometers} km`



                  : "—"}



              </Text>







            </View>



          </View>







        </View>







        {/* =================================================

            TIPOLOGIA + FATTURA

        ================================================= */}



        <View style={styles.compactRow}>



          <View

            style={[

              styles.section,

              styles.compactSection,

              styles.compactLeft,

            ]}

          >

            <SectionHeader

              title="TIPOLOGIA"

              icon={<CarInspectionIcon />}

            />



            <View

              style={[

                styles.sectionBody,

                styles.compactBody,

              ]}

            >

              {lavoro.workType?.trim() ? (

                <Text style={styles.invoiceNumber}>

                  {lavoro.workType.trim()}

                </Text>

              ) : null}

            </View>

          </View>



          <View

            style={[

              styles.section,

              styles.compactSection,

              styles.compactRight,

            ]}

          >

            <SectionHeader

              title="FATTURA N."

              icon={<InvoiceIcon />}

            />



            <View

              style={[

                styles.sectionBody,

                styles.compactBody,

              ]}

            >

              {lavoro.invoiceNumber.trim() ? (

                <Text style={styles.invoiceNumber}>

                  {lavoro.invoiceNumber.trim()}

                </Text>

              ) : null}

            </View>

          </View>



        </View>



        

        {/* =================================================



            PROBLEMI



        ================================================= */}







        <TextListSection



          title="PROBLEMI RISCONTRATI"



          icon={<WrenchIcon />}



          items={problems}



        />







        {/* =================================================



            LAVORI



        ================================================= */}







        {works && (



          <View style={styles.section}>



            <SectionHeader



              title="LAVORI EFFETTUATI"



              icon={<GearIcon />}



            />







            <View style={styles.sectionBody}>



              <View style={styles.bulletRow}>



                <Text style={styles.bullet}>•</Text>







                <Text style={styles.bulletText}>



                  {works}



                </Text>



              </View>



            </View>



          </View>



        )}







        {/* =================================================



            PRODOTTI



        ================================================= */}







        <ProductsSection products={lavoro.products} />







        {/* =================================================

            NOTE

        ================================================= */}



        <View style={styles.section}>

          <SectionHeader

            title="NOTE"

            icon={<NoteIcon />}

          />



          <View

            style={[

              styles.sectionBody,

              styles.notesBody,

            ]}

          >

            {lavoro.notes.trim() ? (

              <Text style={styles.bulletText}>

                {lavoro.notes.trim()}

              </Text>

            ) : null}

          </View>

        </View>



        {/* =================================================



            FIRME



        ================================================= */}







        <View style={styles.signatures}>







          <View



            style={[



              styles.signatureBox,



              styles.signatureLeft,



            ]}



          >



            <View style={styles.signatureTitleRow}>



              <PencilIcon />







              <Text style={styles.signatureTitle}>



                F. AZIENDALE



              </Text>



            </View>







            <View style={styles.signatureLine} />



          </View>







          <View



            style={[



              styles.signatureBox,



              styles.signatureRight,



            ]}



          >



            <View style={styles.signatureTitleRow}>



              <PencilIcon />







              <Text style={styles.signatureTitle}>



                F. CLIENTE



              </Text>



            </View>







            <View style={styles.signatureLine} />



          </View>







        </View>







      </Page>



    </Document>



  );



}