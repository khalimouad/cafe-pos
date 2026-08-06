import { useCallback, useEffect, useState } from 'react'

export type Lang = 'fr' | 'ma'

const KEY = 'cafe-pos-lang'

type Dict = Record<string, string>

const fr: Dict = {
  // Général
  app_name: 'Café POS',
  cash: 'espèces',
  cancel: 'Annuler',
  add: 'Ajouter',
  delete: 'Supprimer',
  yes: 'Oui',
  no: 'Non',
  close_sheet: 'Fermer',
  loading: 'Connexion à la caisse…',
  offline_title: 'Caisse injoignable',
  offline_sub: 'Impossible de joindre la base de données. Vérifiez la connexion internet du poste.',
  offline_chip: 'Hors ligne',
  retry: 'Réessayer',
  save: 'Enregistrer',
  set_pin_hidden: 'Les codes ne sont jamais affichés : saisissez un nouveau code à 4 chiffres pour le remplacer.',
  set_new_pin: 'Nouveau code',
  printer_title: 'Imprimante ticket',
  printer_sub: 'Impression directe, sans boîte de dialogue, via l’agent installé sur le poste (dossier printer-agent). L’imprimante peut être branchée en réseau ou en USB.',
  printer_direct: 'Impression directe',
  printer_agent_url: 'Adresse de l’agent',
  printer_transport: 'Branchement',
  printer_transport_tcp: 'Réseau (Ethernet / Wi-Fi)',
  printer_transport_usb: 'USB direct (Linux / macOS)',
  printer_transport_cups: 'File d’impression CUPS',
  printer_transport_windows: 'Windows (imprimante installée, y compris USB)',
  printer_target_usb: 'Port USB (ex. /dev/usb/lp0)',
  printer_target_cups: 'Nom de la file CUPS (ex. POS80)',
  printer_target_windows: 'Nom Windows (ex. printer WD8260) ou partage \\\\poste\\POS80',
  printer_devices: 'Ports USB détectés sur le poste : {list}',
  printer_windows_list: 'Imprimantes installées sur le poste : {list}',
  printer_ip: 'IP de l’imprimante',
  printer_port: 'Port',
  printer_cut: 'Couper le ticket',
  printer_beep: 'Bip à l’impression',
  printer_check: 'Tester la connexion',
  printer_test: 'Imprimer un ticket de test',
  printer_test_line: 'TICKET DE TEST',
  printer_test_sent: 'Ticket de test envoyé à l’imprimante.',
  printer_ok: 'Imprimante joignable : {target}.',
  printer_unreachable: 'Agent joignable, mais pas l’imprimante : {detail}',
  printer_no_agent: 'Agent d’impression injoignable : {detail}',
  toast_printer_fallback: 'Commande enregistrée. Imprimante injoignable ({detail}) — impression par le navigateur.',

  // Topbar
  tab_pos: 'Caisse',
  tab_history: 'Historique',
  tab_settings: 'Réglages',
  register_open: 'Caisse ouverte',
  register_closed: 'Caisse fermée',
  register_opened_by: 'Ouverte par {name} à {time}',
  register_shared: 'Une seule caisse pour tout le café : ce que fait le poste apparaît ici en direct.',
  close_register: 'Fermer la caisse',
  nav_close: 'Fermer',
  switch_user: 'Changer',
  manager_short: 'resp.',

  // Login
  login_pick: 'Choisissez votre profil caissier',
  login_pin: 'Bonjour {name}, saisissez votre code',
  login_wrong: 'Code incorrect',
  login_back: 'Changer de caissier',
  role_manager: 'Responsable',
  role_cashier: 'Caissier',

  // Ouverture
  open_title: 'Ouverture de caisse',
  open_sub: 'La caisse est fermée. {name}, indiquez le fond de caisse en espèces pour démarrer la journée.',
  open_float: 'Fond de caisse ({currency})',
  open_btn: 'Ouvrir la caisse',
  toast_opened: 'Caisse ouverte',

  // Caisse
  cat_all: 'Tout',
  cart_title: 'Commande',
  cart_clear: 'Vider',
  cart_empty: 'Touchez un produit pour l’ajouter',
  cart_items: '{n} article(s) — espèces',
  pay_btn: 'Valider & imprimer',
  cart_view: 'Voir la commande',
  toast_paid: 'Encaissé {amount} — ticket n°{n}',

  // Historique
  hist_title: 'Historique des commandes',
  hist_sub: 'Toutes les commandes sont réglées en espèces au moment de la validation.',
  filter_session: 'Session en cours',
  filter_today: 'Aujourd’hui',
  filter_all: 'Tout',
  filter_cashiers: 'Tous les caissiers',
  stat_orders: 'Commandes',
  stat_total: 'Total encaissé',
  stat_avg: 'Ticket moyen',
  stat_best: 'Meilleur caissier',
  th_cashier: 'Caissier',
  th_orders: 'Commandes',
  th_total: 'Total',
  hist_empty: 'Aucune commande pour ce filtre.',
  hist_items: '{n} article(s)',
  hist_reprint: 'Réimprimer',
  hist_register_of: 'caisse du {date}',
  hist_total_at: 'Total espèces — {time}',

  // Fermeture
  close_title: 'Fermeture de caisse',
  close_sub: 'Ouverte le {date} par {opener} · fermeture par {closer}',
  close_tickets: 'Tickets',
  close_sales: 'Ventes espèces',
  close_float: 'Fond de caisse',
  close_expected: 'Attendu en caisse',
  close_counted: 'Espèces comptées dans le tiroir ({currency})',
  close_diff: 'Écart',
  close_btn: 'Fermer la caisse & imprimer le Z',
  toast_closed: 'Caisse fermée',

  // Réglages
  set_title: 'Réglages',
  set_sub: 'Carte, caissiers et informations imprimées sur le ticket.',
  set_shop: 'Établissement',
  set_name: 'Nom',
  set_address: 'Adresse',
  set_phone: 'Téléphone',
  set_currency: 'Devise',
  set_footer: 'Message de bas de ticket',
  set_menu: 'Carte ({n} produits)',
  set_product: 'Produit',
  set_category: 'Catégorie',
  set_price: 'Prix',
  set_visible: 'Visible',
  set_icon: 'Icône',
  set_product_name: 'Nom du produit',
  set_cashiers: 'Caissiers',
  set_cashier_name: 'Nom du caissier',
  set_pin: 'Code à 4 chiffres',
  set_code: 'Code',
  set_role: 'Rôle',
  set_confirm_delete: 'Supprimer le caissier {name} ?',
  set_confirm_delete_product: 'Supprimer {name} de la carte ? Les commandes déjà passées ne changent pas.',
  set_delete_hint: 'Masquer un produit le retire de la caisse sans toucher à la carte ; le supprimer l’efface définitivement.',
  set_revenue: 'Chiffre d’affaires total enregistré : {amount} sur {n} commandes.',

  // Ticket
  tk_phone: 'Tél',
  tk_ticket_no: 'Ticket n°',
  tk_cashier: 'Caissier',
  tk_total: 'TOTAL',
  tk_payment: 'Règlement',
  tk_cash: 'ESPÈCES',
  tk_z_title: 'RAPPORT DE CAISSE (Z)',
  tk_opened: 'Ouverture',
  tk_closed: 'Fermeture',
  tk_opened_by: 'Ouverte par',
  tk_closed_by: 'Fermée par',
  tk_count: 'Nombre de tickets',
  tk_float: 'Fond de caisse',
  tk_sales: 'Ventes espèces',
  tk_expected: 'Attendu en caisse',
  tk_counted: 'Compté',
  tk_diff: 'Écart',
}

const ma: Dict = {
  app_name: 'لاكيس ديال القهوة',
  cash: 'كاش',
  cancel: 'لا، رجّع',
  add: 'زيد',
  delete: 'مسح',
  yes: 'واه',
  no: 'لا',
  close_sheet: 'سدّ',
  loading: 'كنتصلو بلاكيس…',
  offline_title: 'لاكيس ماوصلاش',
  offline_sub: 'ماقدرناش نوصلو للقاعدة ديال المعطيات. شوف الأنترنيت ديال البوسط.',
  offline_chip: 'ماشي مربوط',
  retry: 'عاود جرّب',
  save: 'سجّل',
  set_pin_hidden: 'الكودات ماكيبانوش : دخّل كود جديد ب 4 أرقام باش تبدّلو.',
  set_new_pin: 'كود جديد',
  printer_title: 'الطابعة ديال التيكي',
  printer_sub: 'الطباعة ديريكت بلا ما يطلع شي بوكس، عن طريق البرنامج الصغير اللي ف البوسط (printer-agent). الطابعة تقدر تكون مربوطة بالشبكة ولا ب USB.',
  printer_direct: 'طباعة ديريكت',
  printer_agent_url: 'العنوان ديال البرنامج',
  printer_transport: 'نوع الربط',
  printer_transport_tcp: 'الشبكة (Ethernet / Wi-Fi)',
  printer_transport_usb: 'USB ديريكت (Linux / macOS)',
  printer_transport_cups: 'فيل ديال الطباعة CUPS',
  printer_transport_windows: 'Windows (طابعة مركّبة، حتى USB)',
  printer_target_usb: 'البور USB (مثلا /dev/usb/lp0)',
  printer_target_cups: 'سمية الفيل CUPS (مثلا POS80)',
  printer_target_windows: 'السمية ف Windows (مثلا printer WD8260) ولا المشاركة \\\\poste\\POS80',
  printer_devices: 'البورات USB اللي تلقاو ف البوسط : {list}',
  printer_windows_list: 'الطابعات المركّبة ف البوسط : {list}',
  printer_ip: 'IP ديال الطابعة',
  printer_port: 'البور',
  printer_cut: 'قطّع التيكي',
  printer_beep: 'صفّر منين تطبع',
  printer_check: 'جرّب الاتصال',
  printer_test: 'طبع تيكي ديال التجربة',
  printer_test_line: 'تيكي ديال التجربة',
  printer_test_sent: 'تصيفط تيكي ديال التجربة للطابعة.',
  printer_ok: 'الطابعة واصلة : {target}.',
  printer_unreachable: 'البرنامج واصل، ولكن الطابعة لا : {detail}',
  printer_no_agent: 'البرنامج ديال الطباعة ماوصلش : {detail}',
  toast_printer_fallback: 'الكوموند تسجلات. الطابعة ماوصلاتش ({detail}) — غادي نطبعو من النافيݣاتور.',

  tab_pos: 'لاكيس',
  tab_history: 'الكوموندات',
  tab_settings: 'الريݣلاج',
  register_open: 'لاكيس محلولة',
  register_closed: 'لاكيس مسدودة',
  register_opened_by: 'حلّها {name} ف {time}',
  register_shared: 'كاين غير لاكيس وحدة ف القهوة : اللي كيدير البوسط كيبان هنا ديريكت.',
  close_register: 'سدّ لاكيس',
  nav_close: 'سدّ',
  switch_user: 'بدّل',
  manager_short: 'مسؤول',

  login_pick: 'ختار شكون نتا',
  login_pin: 'مرحبا {name}، دخّل الكود ديالك',
  login_wrong: 'الكود ماشي صحيح',
  login_back: 'بدّل الكاسي',
  role_manager: 'المسؤول',
  role_cashier: 'كاسي',

  open_title: 'حلّ لاكيس',
  open_sub: 'لاكيس مسدودة. {name}، دخّل الفلوس اللي غادي تبدا بيهم النهار.',
  open_float: 'لافون ديال لاكيس ({currency})',
  open_btn: 'حلّ لاكيس',
  toast_opened: 'لاكيس تحلّات',

  cat_all: 'كولشي',
  cart_title: 'الكوموند',
  cart_clear: 'خوّي',
  cart_empty: 'كليك على شي حاجة باش تزيدها للكوموند',
  cart_items: '{n} حوايج — كاش',
  pay_btn: 'خلّص و طبع',
  cart_view: 'شوف الكوموند',
  toast_paid: 'تخلّص {amount} — تيكي رقم {n}',

  hist_title: 'الكوموندات اللي دازو',
  hist_sub: 'كاع الكوموندات كيتخلّصو كاش منين كتصيفط الكوموند.',
  filter_session: 'لاكيس ديال دابا',
  filter_today: 'اليوم',
  filter_all: 'كولشي',
  filter_cashiers: 'كاع الكاسيات',
  stat_orders: 'الكوموندات',
  stat_total: 'المجموع اللي دخل',
  stat_avg: 'معدل التيكي',
  stat_best: 'أحسن كاسي',
  th_cashier: 'الكاسي',
  th_orders: 'الكوموندات',
  th_total: 'المجموع',
  hist_empty: 'ماكاين حتى كوموند ف هاد الفيلتر.',
  hist_items: '{n} حوايج',
  hist_reprint: 'عاود طبع',
  hist_register_of: 'لاكيس ديال {date}',
  hist_total_at: 'المجموع كاش — {time}',

  close_title: 'سدّ لاكيس',
  close_sub: 'تحلّات ف {date} من طرف {opener} · سدّها {closer}',
  close_tickets: 'التيكيات',
  close_sales: 'اللي تباع كاش',
  close_float: 'لافون ديال لاكيس',
  close_expected: 'خاصو يكون ف لاكيس',
  close_counted: 'الفلوس اللي حسبتي ف التيروار ({currency})',
  close_diff: 'الفرق',
  close_btn: 'سدّ لاكيس و طبع الرابور',
  toast_closed: 'لاكيس تسدّات',

  set_title: 'الريݣلاج',
  set_sub: 'لاكارط، الكاسيات، و المعلومات اللي كيتطبعو ف التيكي.',
  set_shop: 'المحل',
  set_name: 'السمية',
  set_address: 'العنوان',
  set_phone: 'التيليفون',
  set_currency: 'العملة',
  set_footer: 'الرسالة ف لاخر ديال التيكي',
  set_menu: 'لاكارط ({n} حوايج)',
  set_product: 'الحاجة',
  set_category: 'النوع',
  set_price: 'الثمن',
  set_visible: 'كيبان',
  set_icon: 'الصورة',
  set_product_name: 'سمية الحاجة',
  set_cashiers: 'الكاسيات',
  set_cashier_name: 'سمية الكاسي',
  set_pin: 'كود ب 4 أرقام',
  set_code: 'الكود',
  set_role: 'الدور',
  set_confirm_delete: 'بغيتي تمسح الكاسي {name} ؟',
  set_confirm_delete_product: 'بغيتي تمسح {name} من لاكارط ؟ الكوموندات اللي دازو ماغاديش يتبدلو.',
  set_delete_hint: 'إلا خبّيتي شي حاجة غادي تختافى من لاكيس بلا ما تتمسح ؛ المسح كيمسحها للأبد.',
  set_revenue: 'المجموع اللي دخل من اللول : {amount} ف {n} كوموند.',

  tk_phone: 'التيليفون',
  tk_ticket_no: 'تيكي رقم',
  tk_cashier: 'الكاسي',
  tk_total: 'المجموع',
  tk_payment: 'الخلاص',
  tk_cash: 'كاش',
  tk_z_title: 'رابور ديال لاكيس (Z)',
  tk_opened: 'الحلّ',
  tk_closed: 'السدّ',
  tk_opened_by: 'حلّها',
  tk_closed_by: 'سدّها',
  tk_count: 'عدد التيكيات',
  tk_float: 'لافون ديال لاكيس',
  tk_sales: 'اللي تباع كاش',
  tk_expected: 'خاصو يكون ف لاكيس',
  tk_counted: 'المحسوب',
  tk_diff: 'الفرق',
}

const DICTS: Record<Lang, Dict> = { fr, ma }

export type T = (key: keyof typeof fr | string, params?: Record<string, string | number>) => string

function read(): Lang {
  const v = localStorage.getItem(KEY)
  return v === 'ma' ? 'ma' : 'fr'
}

let current: Lang = read()
const listeners = new Set<(l: Lang) => void>()

export function translate(lang: Lang, key: string, params?: Record<string, string | number>) {
  const raw = DICTS[lang][key] ?? DICTS.fr[key] ?? key
  if (!params) return raw
  return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), raw)
}

export function getLang() {
  return current
}

function applyDir(lang: Lang) {
  document.documentElement.lang = lang === 'ma' ? 'ar' : 'fr'
  document.documentElement.dir = lang === 'ma' ? 'rtl' : 'ltr'
}

applyDir(current)

export function useI18n() {
  const [lang, setLang] = useState<Lang>(current)

  useEffect(() => {
    const l = (next: Lang) => setLang(next)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  const setLanguage = useCallback((next: Lang) => {
    current = next
    localStorage.setItem(KEY, next)
    applyDir(next)
    listeners.forEach((l) => l(next))
  }, [])

  const t = useCallback<T>((key, params) => translate(lang, String(key), params), [lang])

  return { lang, setLanguage, t }
}
