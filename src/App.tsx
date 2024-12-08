import React, { useState } from 'react';
import { TradingResult, TradingFormData } from './types/trading';
import TradingForm from './components/TradingForm';
import Result from './components/Result';
import { fetchTradingStrategy } from './services/api';
import { AlertCircle } from 'lucide-react';
import FAQ from './components/Faq';

function App() {
  const [result, setResult] = useState<TradingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: TradingFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchTradingStrategy(formData);
      setResult(data);
    } catch (err) {
      setError('خطا در دریافت اطلاعات. لطفا دوباره تلاش کنید.');
      console.error('Error fetching trading strategy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-[10px] bg-gray-100" >
      <div className="max-w-2xl mx-auto px-6 py-3">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
        Coin Analysis
        </h1>

        <div className="space-y-6">
          <TradingForm onSubmit={handleSubmit} isLoading={isLoading} />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="text-red-500 w-5 h-5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {result && !error && (
            <Result result={result} />
          )}
        </div>
        <FAQ/>
        <div className='mt-[50px] text-center' >Contact Us to Add Your Desired Coin <br/><p className='font-bold' >Peymanhc@gmail.com</p></div>
      </div>
    </div>
  );
}

export default App;