import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ServiceCard } from "@/components/ServiceCard";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Hero3DModel } from "@/components/Hero3DModel";
import { ServiceCategoryTabs } from "@/components/ServiceCategoryTabs";
import { motion } from "framer-motion";

// Define ServiceType locally
interface ServiceType {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  business?: string | null;
  price?: string | null;
  features?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const featuredServices: ServiceType[] = [
  {
    id: "1",
    user_id: "123",
    title: "Professional Photography",
    description: "Capture your special moments with our professional photography services.",
    category: "Photography",
    image: "https://images.unsplash.com/photo-1554048612-b6a482bc67e5?q=80&w=800",
    business: "Frame Perfect Studios",
    features: ["Event coverage", "Portrait sessions", "Photo editing"]
  },
  {
    id: "2",
    user_id: "456",
    title: "Home Cleaning Services",
    description: "Keep your home clean and tidy with our reliable cleaning services.",
    category: "Cleaning",
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=800",
    business: "Sparkling Homes Inc.",
    features: ["Deep cleaning", "Regular maintenance", "Eco-friendly products"]
  },
  {
    id: "3",
    user_id: "789",
    title: "Web Design & Development",
    description: "Get a stunning website that drives results with our expert web design services.",
    category: "Web Development",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=800",
    business: "Digital Edge Solutions",
    features: ["Responsive design", "E-commerce solutions", "SEO optimization"]
  },
];

export default function Index() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
      }
    });
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/home');
    }
  }, [user, navigate]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    
    // Here you would typically integrate with your email service
    toast({
      title: "Success!",
      description: "Thank you for subscribing to our newsletter!",
    });
    setEmail("");
  };

  const handleServiceClick = (serviceTitle: string) => {
    // Navigate to discover page with search query and services tab
    navigate(`/discover?search=${encodeURIComponent(serviceTitle)}&tab=services`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background via-background to-background dark:from-black dark:via-gray-900 dark:to-black">
      <Header />

      <main className="flex-1">
        {/* Hero Section with 3D Model */}
        <section className="py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-grid-black/5 dark:bg-grid-white/5 bg-grid-16 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]"></div>
          </div>
          
          <div className="container mx-auto px-4 md:px-8 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl max-md:pt-8 lg:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-600">
                Find Local Services with Ease
              </h1>
              <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto text-foreground/80 dark:text-white/80">
                Discover and connect with trusted service providers in your community.
              </p>
              <Link to="/auth">
                <Button size="lg" className="font-semibold animate-none bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                  Get Started
                </Button>
              </Link>
            </motion.div>
            
            <div className="mt-12">
              <Hero3DModel />
            </div>
          </div>
        </section>

        {/* Service Categories Section */}
        <section className="py-16 relative">
          <div className="container mx-auto px-4 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold mb-4 text-foreground dark:text-white">Explore Service Categories</h2>
              <p className="text-foreground/70 dark:text-white/70 max-w-2xl mx-auto">
                Browse through our wide range of service categories to find exactly what you need
              </p>
            </motion.div>
            
            <ServiceCategoryTabs />
          </div>
        </section>

        <section className="py-16 bg-secondary/50 dark:bg-black/50 backdrop-blur-md">
          <div className="container mx-auto px-4 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold mb-4 text-foreground dark:text-white">Featured Services</h2>
              <p className="text-foreground/70 dark:text-white/70 max-w-2xl mx-auto">
                Check out some of our most popular services that are highly rated by our users
              </p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredServices.map((service, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  onClick={() => handleServiceClick(service.title)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="cursor-pointer"
                >
                  <div className="bg-card/80 dark:bg-white/5 backdrop-blur-md rounded-lg shadow-lg overflow-hidden hover:bg-card dark:hover:bg-white/10 transition-colors">
                    <div className="aspect-video relative">
                      <img
                        src={service.image}
                        alt={service.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2 dark:text-white text-black">{service.title}</h3>
                      <p className="text-foreground/70 dark:text-white/70 mb-4">{service.description}</p>
                      <div className="space-y-2">
                        {service.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center text-sm text-foreground/60 dark:text-white/60">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-gradient-to-b from-background/80 to-background dark:from-blue-900/30 dark:to-purple-900/30">
          <div className="container mx-auto px-4 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold mb-4 text-foreground dark:text-white">Why Choose Us?</h2>
              <p className="text-foreground/70 dark:text-white/70 max-w-2xl mx-auto">
                Ventureezon provides a seamless experience for finding and booking services
              </p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="text-center p-8 bg-card/80 dark:bg-white/5 backdrop-blur-md rounded-xl shadow-lg hover:bg-card dark:hover:bg-white/10 transition-colors"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground dark:text-white">Wide Range of Services</h3>
                <p className="text-foreground/70 dark:text-white/70">
                  From home repair to personal care, find everything you need in one place.
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="text-center p-8 bg-card/80 dark:bg-white/5 backdrop-blur-md rounded-xl shadow-lg hover:bg-card dark:hover:bg-white/10 transition-colors"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground dark:text-white">Trusted Providers</h3>
                <p className="text-foreground/70 dark:text-white/70">
                  We carefully vet our service providers to ensure quality and reliability.
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="text-center p-8 bg-card/80 dark:bg-white/5 backdrop-blur-md rounded-xl shadow-lg hover:bg-card dark:hover:bg-white/10 transition-colors"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground dark:text-white">Easy Booking</h3>
                <p className="text-foreground/70 dark:text-white/70">
                  Our platform makes it simple to book services and manage your appointments.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-black/60 backdrop-blur-md text-white">
          <div className="container mx-auto px-4 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="max-w-2xl mx-auto text-center"
            >
              <h2 className="text-3xl font-bold mb-4">Stay Updated</h2>
              <p className="text-white/70 mb-6">
                Subscribe to our newsletter for the latest services and exclusive offers.
              </p>
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 justify-center">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-w-[300px] bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400"
                />
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  Subscribe
                </Button>
              </form>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
