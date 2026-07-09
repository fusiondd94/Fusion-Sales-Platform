import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("A valid email is required."),
  phone: z.string().min(7, "Phone number is required."),
  company: z.string().min(2, "Business name is required."),
  website: z.string().optional(),
  projectNotes: z.string().optional()
});

export type CustomerInfo = z.infer<typeof customerSchema>;

export const emptyCustomer: CustomerInfo = {
  name: "",
  email: "",
  phone: "",
  company: "",
  website: "",
  projectNotes: ""
};
