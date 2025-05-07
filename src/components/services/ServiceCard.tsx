import React, { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { formatPrice, formatCurrency } from "@/lib/utils";
import { Clock, MapPin, MoreVertical, Star } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DeleteServiceModal } from "./DeleteServiceModal";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ServiceCardProps {
  service: {
    id: string;
    title: string;
    description: string;
    category: string;
    price: number;
    currency_created_in: string;
    location: string;
    duration_minutes: number;
    image: string | null;
    owner_id: string;
    ratings_count: number;
    ratings_sum: number;
  };
  showOptions?: boolean;
  onDelete?: (id: string) => void;
  refreshServices?: () => void;
}

export function ServiceCard({ service, showOptions = false, onDelete, refreshServices }: ServiceCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { formatPrice } = useCurrency();
  
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      cleaning: "bg-primary",
      repair: "bg-primary",
      health: "bg-primary",
      education: "bg-primary",
      tech: "bg-primary",
      beauty: "bg-primary",
      delivery: "bg-primary",
      other: "bg-primary",
    };
    return colors[category] || colors.other;
  };

  const handleServiceClick = () => {
    navigate(`/services/${service.id}`);
  };

  const handleDeleteService = async () => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', service.id);
        
      if (error) throw error;
      
      toast({
        title: "Service deleted",
        description: "The service has been successfully deleted",
      });
      
      if (onDelete) {
        onDelete(service.id);
      }
      
      // Refresh the services list if callback provided
      if (refreshServices) {
        refreshServices();
      }
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Error",
        description: "Failed to delete the service. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card className="overflow-hidden h-full transition-all hover:shadow-md cursor-pointer flex flex-col">
        <div className="relative">
          {showOptions && (
            <div className="absolute top-2 right-2 z-10">
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="bg-black/30 hover:bg-black/50 text-white">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(false);
                      setShowDeleteModal(true);
                    }} 
                    className="text-red-500 focus:text-red-500"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <div 
            className="h-48 bg-gray-200 dark:bg-gray-800 overflow-hidden"
            onClick={handleServiceClick}
          >
            {service.image ? (
              <img
                src={service.image}
                alt={service.title}
                className="w-full h-full object-cover transition-transform hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                No image available
              </div>
            )}
          </div>
        </div>
        <CardContent className="flex-1 p-4" onClick={handleServiceClick}>
          <div className="flex justify-between items-start mb-2">
            <Badge className={`${getCategoryColor(service.category)} text-white`}>
              {service.category.charAt(0).toUpperCase() + service.category.slice(1)}
            </Badge>
            <div className="flex justify-between items-center">
              <p className="text-xl font-bold">
                {formatCurrency(service.price, service.currency_created_in)}
              </p>
            </div>
          </div>
          <h3 className="font-bold text-xl mb-2 line-clamp-1">{service.title}</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm line-clamp-2">
            {service.description}
          </p>
        </CardContent>
        <CardFooter className="p-4 pt-0 text-sm text-gray-500 dark:text-gray-400" onClick={handleServiceClick}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              <span className="line-clamp-1">{service.location}</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>
                {service.duration_minutes < 60
                  ? `${service.duration_minutes}m`
                  : `${Math.floor(service.duration_minutes / 60)}h${
                      service.duration_minutes % 60 ? ` ${service.duration_minutes % 60}m` : ""
                    }`}
              </span>
            </div>
          </div>
        </CardFooter>
      </Card>
      
      <DeleteServiceModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteService}
        serviceTitle={service.title}
      />
    </>
  );
}
