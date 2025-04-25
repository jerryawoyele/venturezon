import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

// Define service categories with their icons
const categories = [
  {
    id: 'home-services',
    name: 'Home Services',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    services: [
      'Cleaning Services',
      'Plumbing',
      'Electrical Work',
      'Painting',
      'Furniture Assembly',
      'Gardening & Landscaping'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    services: [
      'Legal Consultation',
      'Financial Advisory',
      'Business Consulting',
      'Tax Preparation',
      'Marketing Services',
      'Graphic Design'
    ]
  },
  {
    id: 'health',
    name: 'Health & Wellness',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    services: [
      'Fitness Training',
      'Yoga Instruction',
      'Nutritional Consulting',
      'Massage Therapy',
      'Mental Health Counseling',
      'Physical Therapy'
    ]
  },
  {
    id: 'tech',
    name: 'Technology',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    services: [
      'Web Development',
      'App Development',
      'IT Support',
      'Computer Repair',
      'Data Analysis',
      'SEO Optimization'
    ]
  },
  {
    id: 'events',
    name: 'Events',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    services: [
      'Wedding Planning',
      'Photography',
      'Catering',
      'Event Decorating',
      'DJ & Entertainment',
      'Venue Rental'
    ]
  }
];

export function ServiceCategoryTabs() {
  const [activeTab, setActiveTab] = useState(categories[0].id);
  const navigate = useNavigate();

  const handleServiceClick = (service: string) => {
    // Navigate to discover page with the service as search query and services tab
    navigate(`/discover?search=${encodeURIComponent(service)}&tab=services`);
  };

  return (
    <Tabs 
      defaultValue={categories[0].id} 
      value={activeTab} 
      onValueChange={setActiveTab}
      className="w-full"
    >
      <div className="relative">
        <div className="absolute inset-y-0 right-0 w-8 h-full bg-gradient-to-l from-black to-transparent pointer-events-none md:hidden z-10"></div>
        <div className="absolute inset-y-0 left-0 w-8 h-full bg-gradient-to-r from-black to-transparent pointer-events-none md:hidden z-10"></div>
        <TabsList className="mb-8 w-full h-full max-md:px-6 flex overflow-x-auto py-2 justify-start lg:justify-center gap-2 no-scrollbar snap-x">
          {categories.map((category) => (
            <TabsTrigger 
              key={category.id} 
              value={category.id}
              className="min-w-[120px] md:min-w-fit px-4 md:px-6 py-3 text-sm md:text-base flex flex-col md:flex-row items-center gap-2 snap-start data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600/20 data-[state=active]:to-purple-600/20 data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
              onClick={() => setActiveTab(category.id)}
            >
              <span className="text-blue-400">{category.icon}</span>
              <span className="text-center">{category.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      
      {categories.map((category) => (
        <TabsContent key={category.id} value={category.id} className="mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {category.services.map((service, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="w-full"
                onClick={() => handleServiceClick(service)}
              >
                <Card className="h-full bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 transition-colors cursor-pointer shadow-lg">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                        {category.icon}
                      </div>
                      <h3 className="font-medium dark:text-white  text-black text-sm md:text-base">{service}</h3>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
} 