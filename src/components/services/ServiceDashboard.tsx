import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import {
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  Star,
  Plus,
  TrendingUp,
  Users,
  Activity,
  MessageSquare,
  Bookmark
} from "lucide-react";
import { AddServiceModal } from "./AddServiceModal";
import { ServiceVerificationModal } from "./ServiceVerificationModal";
import { formatPrice } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ServiceDashboardProps {
  services: any[];
  loading: boolean;
  userRole: "business" | "customer";
  onRefresh: () => void;
}

// Stats card component
const StatsCard = ({ title, value, icon, description, trend = null }) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
        </div>
        <div className="p-2 bg-primary/10 rounded-full">
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{description}</p>
        {trend !== null && (
          <Badge
            variant={trend >= 0 ? "default" : "destructive"}
            className="flex items-center"
          >
            {trend >= 0 ? "+" : ""}{trend}%
          </Badge>
        )}
      </div>
    </CardContent>
  </Card>
);

export function ServiceDashboard({ services, loading, userRole, onRefresh }: ServiceDashboardProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [completedBookings, setCompletedBookings] = useState(0);
  const [activeBookings, setActiveBookings] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [activeUserTab, setActiveUserTab] = useState("services");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (services.length > 0) {
      fetchBookings();
      fetchRevenueData();
      fetchCustomerData();
    }
  }, [services]);

  useEffect(() => {
    calculateStats();
  }, [bookings, services]);

  const fetchBookings = async () => {
    try {
      // Get all service IDs owned by this user
      const serviceIds = services.map(s => s.id);

      if (serviceIds.length === 0) {
        setBookings([]);
        return;
      }

      // Fetch bookings with enriched data
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          escrow_payments (*)
        `)
        .in('service_id', serviceIds);

      if (error) throw error;

      // Get customer profiles for the bookings
      const customerIds = [...new Set(data?.map(booking => booking.customer_id) || [])];

      if (customerIds.length > 0) {
        const { data: customerProfiles, error: customersError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', customerIds);

        if (customersError) throw customersError;

        // Enrich booking data with customer profiles
        const enrichedBookings = data?.map(booking => {
          const customer = customerProfiles?.find(profile => profile.id === booking.customer_id);
          return {
            ...booking,
            customer
          };
        });

        setBookings(enrichedBookings || []);
      } else {
        setBookings(data || []);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast({
        title: "Error",
        description: "Failed to fetch bookings data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchRevenueData = async () => {
    try {
      // Get revenue data for the past 6 months
      const months = [];
      const today = new Date();

      for (let i = 5; i >= 0; i--) {
        const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(month.toISOString());
      }

      // Get all service IDs owned by this user
      const serviceIds = services.map(s => s.id);

      if (serviceIds.length === 0) {
        setRevenueData([]);
        return;
      }

      // Fetch completed bookings with simpler query
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .in('service_id', serviceIds)
        .eq('status', 'completed')
        .gte('created_at', months[0]);

      if (error) throw error;

      // Get services separately if needed
      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .in('id', serviceIds);

      // Get payments separately
      const bookingIds = data?.map(booking => booking.id) || [];
      const { data: paymentsData } = await supabase
        .from('escrow_payments')
        .select('*')
        .in('booking_id', bookingIds);

      // Enrich booking data manually
      const enrichedBookings = data?.map(booking => {
        return {
          ...booking,
          service: servicesData?.find(s => s.id === booking.service_id) || null,
          escrow_payments: paymentsData?.filter(p => p.booking_id === booking.id) || []
        };
      }) || [];

      // Process data into monthly revenue
      const monthlyRevenue = months.map((month, index) => {
        const nextMonth = index < 5 ? months[index + 1] : new Date().toISOString();
        const monthlyBookings = enrichedBookings.filter(
          booking => booking.created_at >= month && booking.created_at < nextMonth
        ) || [];

        const revenue = monthlyBookings.reduce((sum, booking) => {
          return sum + (booking.escrow_payments[0]?.amount || 0);
        }, 0);

        return {
          month: new Date(month).toLocaleDateString('default', { month: 'short' }),
          revenue: revenue,
          bookings: monthlyBookings.length
        };
      });

      setRevenueData(monthlyRevenue);

    } catch (error) {
      console.error("Error fetching revenue data:", error);
    }
  };

  const fetchCustomerData = async () => {
    try {
      // Get all service IDs owned by this user
      const serviceIds = services.map(s => s.id);

      // First, fetch all bookings for your services
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          customer_id,
          service_id
        `)
        .in('service_id', serviceIds);

      if (bookingsError) throw bookingsError;

      // Gather unique customer IDs
      const customerIds = [...new Set(bookingsData?.map(b => b.customer_id) || [])];

      if (customerIds.length === 0) {
        setCustomerData([]);
        return;
      }

      // Now fetch customer profiles and booking counts
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', customerIds);

      if (profilesError) throw profilesError;

      // Count bookings per customer
      const customerCounts = customerIds.map(customerId => {
        const count = bookingsData?.filter(b => b.customer_id === customerId).length || 0;
        const profile = profilesData?.find(p => p.id === customerId);

        return {
          id: customerId,
          name: profile?.username || 'Anonymous',
          avatar: profile?.avatar_url,
          bookings: count
        };
      });

      setCustomerData(customerCounts);
    } catch (error) {
      console.error("Error fetching customer data:", error);
    }
  };

  const calculateStats = () => {
    // Calculate the total revenue from completed bookings
    const totalRevenue = bookings.reduce((sum, booking) => {
      if (booking.status === 'completed') {
        const amount = booking.escrow_payments?.[0]?.amount || 0;
        return sum + amount;
      }
      return sum;
    }, 0);

    // Count bookings by status
    const activeBookings = bookings.filter(b =>
      b.status === 'confirmed' || b.status === 'pending' || b.status === 'in_progress'
    ).length;

    const completedBookings = bookings.filter(b => b.status === 'completed').length;

    // Calculate ratings data directly from services
    let totalRating = 0;
    let ratingCount = 0;

    services.forEach(service => {
      if (service.ratings_count && service.ratings_count > 0) {
        totalRating += (service.ratings_sum || 0);
        ratingCount += service.ratings_count;
      }
    });

    const averageRating = ratingCount > 0 ?
      (totalRating / ratingCount).toFixed(1) :
      "0.0";

    setActiveBookings(activeBookings);
    setCompletedBookings(completedBookings);
    setTotalRevenue(totalRevenue);
  };

  const handleAddService = () => {
    setShowServiceModal(true);
  };

  const handleServiceAdded = (newService: any) => {
    onRefresh();
  };

  const handleViewBookings = (service: any) => {
    navigate(`/services/${service.id}?tab=bookings`);
  };

  const handleVerifyCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setShowVerificationModal(true);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 ">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Services"
          value={services.length}
          icon={<Bookmark className="h-5 w-5 text-primary" />}
          description="Total services you offer"
          trend={null}
        />
        <StatsCard
          title={activeBookings > 0 ? "Active Bookings" : "Total Bookings"}
          value={activeBookings > 0 ? activeBookings : (activeBookings + completedBookings)}
          icon={<Calendar className="h-5 w-5 text-primary" />}
          description={activeBookings > 0 ? "Current active bookings" : "All-time booking count"}
          trend={null}
        />
        <StatsCard
          title="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          icon={<DollarSign className="h-5 w-5 text-primary" />}
          description="All-time earnings"
          trend={null}
        />
        <StatsCard
          title="Average Rating"
          value={services.length > 0 ?
            (() => {
              let totalRating = 0;
              let ratingCount = 0;

              services.forEach(service => {
                if (service.ratings_count && service.ratings_count > 0) {
                  totalRating += (service.ratings_sum || 0);
                  ratingCount += service.ratings_count;
                }
              });

              return ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : "0.0";
            })() :
            "0.0"
          }
          icon={<Star className="h-5 w-5 text-primary" />}
          description={`From ${services.reduce((sum, service) => sum + (service.ratings_count || 0), 0)} ratings`}
          trend={null}
        />
      </div>

      {/* Charts and Data */}
      {/* Services and Customers Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Services Management */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Services</CardTitle>
              <CardDescription>
                Manage your services and view bookings
              </CardDescription>
            </div>
            {/* <Button onClick={handleAddService}>Add Service</Button> */}
            <Button onClick={handleAddService}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Service</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {services.length === 0 ? (
                <div className="text-center p-8 border rounded-lg border-dashed border-muted-foreground/50">
                  <h3 className="text-lg font-semibold mb-2">No Services Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your first service to start receiving bookings.
                  </p>
                  <Button onClick={handleAddService}>Add Service</Button>
                </div>
              ) : (
                services.map((service) => {
                  const serviceBookings = bookings.filter(b => b.service_id === service.id);
                  return (
                    <div key={service.id} className="flex flex-col sm:flex-row justify-between gap-4 border-b pb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-md overflow-hidden">
                          <img
                            src={service.image || "https://via.placeholder.com/150"}
                            alt={service.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <h3 className="font-medium">{service.title}</h3>
                          <p className="text-sm text-muted-foreground">{formatPrice(service.price)} - {service.category}</p>
                          <div className="flex items-center text-xs gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {serviceBookings.length} bookings
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewBookings(service)}
                        >
                          View Bookings
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer Management */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
            <CardDescription>
              View your most active customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {customerData.length === 0 ? (
                <p className="text-center text-muted-foreground">No customer data yet</p>
              ) : (
                customerData.slice(0, 5).map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 flex-shrink-0 rounded-full overflow-hidden bg-muted">
                        {customer.avatar ? (
                          <img
                            src={customer.avatar}
                            alt={customer.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-medium">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium truncate">{customer.name}</h3>
                        <p className="text-xs text-muted-foreground">{customer.bookings} bookings</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0"
                      onClick={() => handleVerifyCustomer(customer)}
                    >
                      Verify
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" className="w-full">View All Customers</Button>
          </CardFooter>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Revenue & Bookings Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue & Bookings</CardTitle>
            <CardDescription>
              Monthly revenue and booking trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={revenueData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                  name="Revenue ($)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="bookings"
                  stroke="#82ca9d"
                  name="Bookings"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Booking Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Status</CardTitle>
            <CardDescription>
              Distribution of booking statuses
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={250} minWidth={200}>
              <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <Pie
                  data={[{ name: 'Active', value: activeBookings }, { name: 'Completed', value: completedBookings }]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {[{ name: 'Active', value: activeBookings }, { name: 'Completed', value: completedBookings }].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                <Tooltip formatter={(value, name) => [`${value} (${((value / (activeBookings + completedBookings || 1)) * 100).toFixed(0)}%)`, name]} />
              </PieChart>
            </ResponsiveContainer>

            {/* Status Legend with Percentages */}
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              <div className="flex items-center">
                <div className="w-3 h-3 mr-1 rounded-sm" style={{ backgroundColor: COLORS[0] }}></div>
                <span className="text-sm">Active: {activeBookings > 0 ? ((activeBookings / (activeBookings + completedBookings)) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 mr-1 rounded-sm" style={{ backgroundColor: COLORS[1] }}></div>
                <span className="text-sm">Completed: {completedBookings > 0 ? ((completedBookings / (activeBookings + completedBookings)) * 100).toFixed(0) : 0}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Modals */}
      {showServiceModal && (
        <AddServiceModal
          isOpen={showServiceModal}
          onClose={() => setShowServiceModal(false)}
          onServiceAdded={handleServiceAdded}
        />
      )}

      {showVerificationModal && selectedCustomer && (
        <ServiceVerificationModal
          isOpen={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          customerId={selectedCustomer.id}
        />
      )}
    </div>
  );
} 