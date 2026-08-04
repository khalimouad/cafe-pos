import { useI18n } from '../lib/i18n'

export default function LangSwitch() {
  const { lang, setLanguage } = useI18n()
  return (
    <div className="langswitch">
      <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLanguage('fr')}>FR</button>
      <button className={lang === 'ma' ? 'on' : ''} onClick={() => setLanguage('ma')}>دارجة</button>
    </div>
  )
}
