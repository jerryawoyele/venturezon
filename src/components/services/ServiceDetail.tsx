import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { BookNowButton } from "./BookNowButton";
import { MultiStepBookingModal } from "./MultiStepBookingModal";

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  currency_created_in: string;
  owner_id: string;
  // Add other fields as needed
}

interface ServiceDetailProps {
  service: Service;
}

export function ServiceDetail({ service }: ServiceDetailProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between mb-6">
        <h1 className="text-3xl font-bold mb-2 md:mb-0">{service.title}</h1>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold">
            {formatCurrency(service.price, service.currency_created_in)}
          </p>
          <BookNowButton service={service} onOpenModal={handleOpenModal} />
        </div>
      </div>
      
      {/* Booking Modal */}
      <MultiStepBookingModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        currentService={service} 
        providerId={service.owner_id} 
      />
      
      {/* Rest of the component */}
    </div>
  );
} 