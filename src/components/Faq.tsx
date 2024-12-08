import React, { useState } from 'react';
import {LucideMessageCircleQuestion} from "lucide-react"
interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "What is the Current Price?",
    answer: "The latest price at which the cryptocurrency is trading in the market is 25.26."
  },
  {
    question: "What is Support?",
    answer: "Support is a potential level where buying interest may increase, preventing the price from falling further. The support level is 24.6800."
  },
  {
    question: "What is Resistance?",
    answer: "Resistance is a potential level where selling pressure may intensify, preventing the price from rising further. The resistance level is 25.2900."
  },
  {
    question: "What does Short Term mean?",
    answer: "It indicates the short-term recommendation for the cryptocurrency. Currently, it suggests a 'Get Short Position', expecting a price decline."
  },
  {
    question: "What is the Trend?",
    answer: "The overall market direction is an Uptrend, characterized by higher highs and higher lows."
  },
  {
    question: "What is the Price Action Signal?",
    answer: "The signal is Bullish, suggesting that the price action is favorable for buyers, indicating potential upward movement."
  },
  {
    question: "What are Ichimoku Components?",
    answer: "Ichimoku components include Tenkan-sen, Kijun-sen, Senkou Span A, Senkou Span B, and Chikou Span, which help identify trends and momentum."
  },
  {
    question: "What is Tenkan-sen?",
    answer: "Tenkan-sen, also known as the Conversion Line, is calculated as the average of the highest high and lowest low over the last 9 periods. It indicates short-term market momentum."
  },
  {
    question: "What is Kijun-sen?",
    answer: "Kijun-sen, or the Base Line, is the average of the highest high and lowest low over the last 26 periods. It acts as an indicator of medium-term market trends and potential support or resistance."
  },
  {
    question: "What is Senkou Span A?",
    answer: "Senkou Span A is part of the Ichimoku Cloud and represents the average of Tenkan-sen and Kijun-sen, plotted 26 periods ahead. It helps define the leading edge of the cloud."
  },
  {
    question: "What is Senkou Span B?",
    answer: "Senkou Span B is also part of the Ichimoku Cloud, calculated as the average of the highest high and lowest low over the last 52 periods, plotted 26 periods ahead. It forms the other edge of the cloud."
  },
  {
    question: "What is Chikou Span?",
    answer: "Chikou Span, or the Lagging Span, is the current closing price plotted 26 periods back. It is used to confirm trends and potential support or resistance levels."
  }
];

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [showFaq, setShowFaq] = useState(false)
  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
   <div>
    <div className=' bg-white rounded-lg mt-[16px] px-6 gap-[12px]' >
        <div onClick={()=>setShowFaq(!showFaq)} className='flex justify-between items-center cursor-pointer py-6' >
        <span className='font-bold text-2xl' >Frequently Asked Questions</span>
        <LucideMessageCircleQuestion/>
        </div>
      {showFaq && faqData.map((item, index) => (
        <div key={index} className="mb-2 border-b border-gray-200">
          <button
            onClick={() => toggleOpen(index)}
            className="w-full text-left p-2 font-medium text-gray-700 hover:bg-gray-100"
          >
            {item.question}
          </button>
          {openIndex === index && (
            <div className="p-2 text-gray-600">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
    </div>
    
   

  );
};

export default FAQ;
