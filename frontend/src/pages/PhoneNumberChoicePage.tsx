import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Phone, InfoIcon, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { savePhonePreference } from '@/utils/apiClient';
import { useAuth } from '@/context/AuthContext';

type PhoneNumberChoice = 'new' | 'existing' | null;

interface PhoneNumberChoicePageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const US_AREA_CODES = [
  '201',
  '202',
  '203',
  '205',
  '206',
  '207',
  '208',
  '209',
  '210',
  '212',
  '213',
  '214',
  '215',
  '216',
  '217',
  '218',
  '219',
  '220',
  '224',
  '225',
  '228',
  '229',
  '231',
  '234',
  '239',
  '240',
  '248',
  '251',
  '252',
  '253',
  '254',
  '256',
  '260',
  '262',
  '267',
  '268',
  '269',
  '270',
  '272',
  '276',
  '281',
  '283',
  '301',
  '302',
  '303',
  '304',
  '305',
  '306',
  '307',
  '308',
  '309',
  '310',
  '312',
  '313',
  '314',
  '315',
  '316',
  '317',
  '318',
  '319',
  '320',
  '321',
  '323',
  '325',
  '330',
  '331',
  '334',
  '336',
  '337',
  '339',
  '346',
  '347',
  '351',
  '352',
  '360',
  '361',
  '362',
  '369',
  '371',
  '380',
  '385',
  '386',
  '401',
  '402',
  '403',
  '404',
  '405',
  '406',
  '407',
  '408',
  '409',
  '410',
  '412',
  '413',
  '414',
  '415',
  '417',
  '418',
  '419',
  '423',
  '424',
  '425',
  '428',
  '430',
  '431',
  '432',
  '434',
  '435',
  '440',
  '441',
  '442',
  '443',
  '445',
  '450',
  '469',
  '470',
  '472',
  '475',
  '478',
  '479',
  '480',
  '484',
  '501',
  '502',
  '503',
  '504',
  '505',
  '506',
  '507',
  '508',
  '509',
  '510',
  '512',
  '513',
  '514',
  '515',
  '516',
  '517',
  '518',
  '519',
  '520',
  '530',
  '531',
  '534',
  '539',
  '540',
  '541',
  '551',
  '559',
  '561',
  '562',
  '563',
  '564',
  '567',
  '570',
  '571',
  '573',
  '574',
  '575',
  '580',
  '581',
  '585',
  '586',
  '601',
  '602',
  '603',
  '604',
  '605',
  '606',
  '607',
  '608',
  '609',
  '610',
  '612',
  '613',
  '614',
  '615',
  '616',
  '617',
  '618',
  '619',
  '620',
  '623',
  '626',
  '628',
  '629',
  '630',
  '631',
  '636',
  '641',
  '646',
  '650',
  '651',
  '657',
  '659',
  '660',
  '661',
  '662',
  '667',
  '669',
  '670',
  '671',
  '678',
  '679',
  '680',
  '681',
  '682',
  '684',
  '689',
  '701',
  '702',
  '703',
  '704',
  '705',
  '706',
  '707',
  '708',
  '709',
  '710',
  '712',
  '713',
  '714',
  '715',
  '716',
  '717',
  '718',
  '719',
  '720',
  '721',
  '724',
  '725',
  '726',
  '727',
  '731',
  '732',
  '734',
  '740',
  '743',
  '747',
  '754',
  '757',
  '760',
  '762',
  '763',
  '765',
  '769',
  '770',
  '771',
  '772',
  '773',
  '774',
  '775',
  '776',
  '778',
  '779',
  '780',
  '781',
  '782',
  '785',
  '786',
  '787',
  '801',
  '802',
  '803',
  '804',
  '805',
  '806',
  '807',
  '808',
  '809',
  '810',
  '812',
  '813',
  '814',
  '815',
  '816',
  '817',
  '818',
  '819',
  '820',
  '825',
  '828',
  '830',
  '831',
  '832',
  '833',
  '835',
  '838',
  '843',
  '845',
  '847',
  '848',
  '850',
  '854',
  '856',
  '857',
  '858',
  '859',
  '860',
  '862',
  '863',
  '864',
  '865',
  '870',
  '878',
  '880',
  '881',
  '882',
  '883',
  '884',
  '885',
  '886',
  '901',
  '902',
  '903',
  '904',
  '905',
  '906',
  '907',
  '908',
  '909',
  '910',
  '912',
  '913',
  '914',
  '915',
  '916',
  '917',
  '918',
  '919',
  '920',
  '925',
  '928',
  '929',
  '931',
  '932',
  '934',
  '936',
  '937',
  '938',
  '940',
  '941',
  '942',
  '944',
  '945',
  '947',
  '948',
  '949',
  '951',
  '952',
  '954',
  '956',
  '959',
  '970',
  '971',
  '972',
  '973',
  '974',
  '975',
  '978',
  '979',
  '980',
  '984',
  '985',
  '986',
  '989'
];

export default function PhoneNumberChoicePage({ theme, onToggleTheme }: PhoneNumberChoicePageProps) {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [choice, setChoice] = useState<PhoneNumberChoice>(null);
  const [areaCode, setAreaCode] = useState<string>('');
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authState?.tokens?.accessToken) {
      navigate('/signup', { replace: true });
    }
  }, [authState, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!choice) return;
    if (choice === 'new' && !areaCode) return;

    setIsLoadingForm(true);
    setErrorMessage(null);

    try {
      await savePhonePreference({
        option: choice,
        areaCode: choice === 'new' ? areaCode : undefined
      });

      navigate('/confirmation');
    } catch (error) {
      const message =
        (error as any)?.data?.message ||
        (error as Error).message ||
        'Failed to save your phone number preference. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleBack = () => {
    navigate('/square-oauth');
  };

  const isFormValid = choice && (choice === 'existing' || (choice === 'new' && areaCode));

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text-primary dark:text-dark-text-primary transition-colors duration-300">
      <Header theme={theme} onToggleTheme={onToggleTheme} />

      <main className="flex-1">
        <section className="relative min-h-[calc(100vh-80px)] flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-light-bg dark:bg-dark-bg" />

          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary-light/20 to-transparent rounded-full blur-3xl opacity-50 animate-glow-pulse" />
            <div
              className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-accent-blue/20 to-transparent rounded-full blur-3xl opacity-40 animate-glow-pulse"
              style={{ animationDelay: '1s' }}
            />
          </div>

          <div className="relative z-10 w-full max-w-2xl">
            <div className="space-y-8 animate-fade-in">
              {/* Header */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-light/20 text-primary-light font-semibold">
                    4
                  </div>
                  <h1 className="heading-2 text-left">Choose Your Phone Number</h1>
                </div>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Decide how your AI receptionist will receive calls
                </p>
              </div>

              {/* Card */}
              <div className="card space-y-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {errorMessage && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Option 1: New AI Number */}
                  <div>
                    <label
                      className="flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200"
                      style={{
                        borderColor: choice === 'new' ? 'var(--primary-light)' : 'var(--light-border)',
                        backgroundColor: choice === 'new' ? 'rgba(0, 199, 199, 0.05)' : 'transparent'
                      }}
                    >
                      <input
                        type="radio"
                        name="phoneChoice"
                        value="new"
                        checked={choice === 'new'}
                        onChange={e => setChoice(e.target.value as 'new')}
                        className="mt-1 w-5 h-5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className="w-5 h-5 text-primary-light" />
                          <h3 className="font-semibold">Get a New AI-Powered Number</h3>
                        </div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-3">
                          We'll assign you a brand new phone number to receive all customer calls
                        </p>
                        {choice === 'new' && (
                          <div className="space-y-3 mt-4">
                            <label className="text-sm font-medium">Select Area Code *</label>
                            <select
                              value={areaCode}
                              onChange={e => setAreaCode(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-primary-light focus:ring-2 focus:ring-primary-light/20"
                            >
                              <option value="">Choose an area code...</option>
                              {US_AREA_CODES.map(code => (
                                <option key={code} value={code}>
                                  {code}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                              Your new number will be: ({areaCode || '___'}) XXX-XXXX
                            </p>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>

                  {/* Option 2: Existing Number */}
                  <div>
                    <label
                      className="flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200"
                      style={{
                        borderColor: choice === 'existing' ? 'var(--primary-light)' : 'var(--light-border)',
                        backgroundColor: choice === 'existing' ? 'rgba(0, 199, 199, 0.05)' : 'transparent'
                      }}
                    >
                      <input
                        type="radio"
                        name="phoneChoice"
                        value="existing"
                        checked={choice === 'existing'}
                        onChange={e => setChoice(e.target.value as 'existing')}
                        className="mt-1 w-5 h-5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">Use My Existing Number</h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          Forward calls from your current business number to our AI receptionist
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Info Card for Selected Option */}
                  {choice === 'new' && (
                    <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
                      <div className="flex gap-3">
                        <InfoIcon className="w-5 h-5 text-accent-blue flex-shrink-0 mt-0.5" />
                        <div className="space-y-2 text-sm">
                          <p className="font-semibold">New Number Setup:</p>
                          <ul className="space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
                            <li>• Number active immediately</li>
                            <li>• Included in your plan</li>
                            <li>• All calls go directly to your AI receptionist</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {choice === 'existing' && (
                    <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4 border border-light-border dark:border-dark-border">
                      <div className="flex gap-3">
                        <InfoIcon className="w-5 h-5 text-accent-blue flex-shrink-0 mt-0.5" />
                        <div className="space-y-2 text-sm">
                          <p className="font-semibold">Number Porting Instructions:</p>
                          <ul className="space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
                            <li>• We'll guide you through the porting process</li>
                            <li>• Your existing number stays active during setup (3-7 days)</li>
                            <li>• No interruption to your service</li>
                            <li>• We handle all carrier communication</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 btn-secondary flex items-center justify-center gap-2 group"
                    >
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={!isFormValid || isLoadingForm}
                      className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      {isLoadingForm ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Setting Up...
                        </>
                      ) : (
                        <>
                          Continue to Confirmation
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer theme={theme} />
    </div>
  );
}
