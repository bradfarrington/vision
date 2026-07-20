import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export { users, sessions, insertUserSchema } from "./models/auth";
export type { InsertUser } from "./models/auth";

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  brandColor1: text("brand_color_1"),
  brandColor2: text("brand_color_2"),
  logoUrl: text("logo_url"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  customerType: text("customer_type").default("residential"),
  title: text("title"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  companyName: text("company_name"),
  email: text("email"),
  phone: text("phone"),
  homeTelephone: text("home_telephone"),
  workTelephone: text("work_telephone"),
  mobile: text("mobile"),
  mobile2: text("mobile_2"),
  houseName: text("house_name"),
  houseNumber: text("house_number"),
  street: text("street"),
  locality: text("locality"),
  town: text("town"),
  county: text("county"),
  postcode: text("postcode"),
  what3Words: text("what_3_words"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  propertyType: text("property_type"),
  notes: text("notes"),
  ttCustomerId: text("tt_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadNumber: integer("lead_number").default(0),
  contractNumber: integer("contract_number"),
  officeReference: text("office_reference"),
  officeReference2: text("office_reference_2"),
  leadDate: timestamp("lead_date").defaultNow(),
  contractDate: timestamp("contract_date"),
  customerId: varchar("customer_id").references(() => customers.id),
  installationHouseName: text("installation_house_name"),
  installationHouseNumber: text("installation_house_number"),
  installationStreet: text("installation_street"),
  installationLocality: text("installation_locality"),
  installationTown: text("installation_town"),
  installationCounty: text("installation_county"),
  installationPostcode: text("installation_postcode"),
  installationWhat3Words: text("installation_what_3_words"),
  sameAsCustomerAddress: boolean("same_as_customer_address").default(true),
  takenBy: varchar("taken_by").references(() => users.id),
  salespersonType: text("salesperson_type"),
  salesman: text("salesman"),
  source: text("source"),
  subSource: text("sub_source"),
  productType: text("product_type"),
  productInterest1: text("product_interest_1"),
  productInterest2: text("product_interest_2"),
  quoteDate: timestamp("quote_date"),
  grossValue: decimal("gross_value", { precision: 10, scale: 2 }),
  resultDate: timestamp("result_date"),
  result: text("result").default("alive"),
  resultReason: text("result_reason"),
  quoteType: text("quote_type"),
  paymentMethod: text("payment_method"),
  status: text("status").default("new"),
  priority: text("priority").default("medium"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  windowCount: integer("window_count"),
  windowTypes: text("window_types").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  followUpDate: timestamp("follow_up_date"),
  supplyOnly: boolean("supply_only").default(false),
  deliveryMethod: text("delivery_method"),
  contractType: text("contract_type"),
  installationManager: text("installation_manager"),
  onHold: boolean("on_hold").default(false),
  holdReason: text("hold_reason"),
  holdDateOn: timestamp("hold_date_on"),
  holdDateOff: timestamp("hold_date_off"),
  contractCancelled: boolean("contract_cancelled").default(false),
  cancelReason: text("cancel_reason"),
  cancelDate: timestamp("cancel_date"),
  salesArea: text("sales_area"),
  salesDirector: text("sales_director"),
  balanceReason: text("balance_reason"),
  oldBalanceReason: text("old_balance_reason"),
  invoiceSameAsCustomer: boolean("invoice_same_as_customer").default(true),
  invoiceName: text("invoice_name"),
  invoiceHouseName: text("invoice_house_name"),
  invoiceHouseNumber: text("invoice_house_number"),
  invoiceStreet: text("invoice_street"),
  invoiceLocality: text("invoice_locality"),
  invoiceTown: text("invoice_town"),
  invoiceCounty: text("invoice_county"),
  invoicePostcode: text("invoice_postcode"),
  fittingSameAsCustomer: boolean("fitting_same_as_customer").default(true),
  fittingHouseName: text("fitting_house_name"),
  fittingHouseNumber: text("fitting_house_number"),
  fittingStreet: text("fitting_street"),
  fittingLocality: text("fitting_locality"),
  fittingTown: text("fitting_town"),
  fittingCounty: text("fitting_county"),
  fittingPostcode: text("fitting_postcode"),
  fittingWhat3Words: text("fitting_what_3_words"),
  fittingDirections: text("fitting_directions"),
  sendLettersToFitting: boolean("send_letters_to_fitting").default(false),
  estimatedFittingDays: decimal("estimated_fitting_days", { precision: 5, scale: 1 }),
  installationCompleted: text("installation_completed"),
  signboardLeft: boolean("signboard_left").default(false),
  signboardDate: text("signboard_date"),
  guaranteeNumber: text("guarantee_number"),
  guaranteeDate: text("guarantee_date"),
  insuranceBackedGuaranteeRef: text("insurance_backed_guarantee_ref"),
  ttCustomerId: text("tt_customer_id"),
  ttSyncStatus: text("tt_sync_status"),
  ttQuoteId: text("tt_quote_id"),
  ttQuoteUrl: text("tt_quote_url"),
  ttQuoteReference: text("tt_quote_reference"),
  ttQuotePdfUrl: text("tt_quote_pdf_url"),
  ttQuotePdfFileName: text("tt_quote_pdf_file_name"),
  ttLastSyncAt: timestamp("tt_last_sync_at"),
});

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  contractNumber: integer("contract_number"),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  contractDate: timestamp("contract_date"),
  officeReference: text("office_reference"),
  officeReference2: text("office_reference_2"),
  grossValue: decimal("gross_value", { precision: 10, scale: 2 }),
  salesman: text("salesman"),
  source: text("source"),
  supplyOnly: boolean("supply_only").default(false),
  deliveryMethod: text("delivery_method"),
  contractType: text("contract_type"),
  contractTypeId: integer("contract_type_id"),
  installationManager: text("installation_manager"),
  onHold: boolean("on_hold").default(false),
  holdReason: text("hold_reason"),
  holdDateOn: timestamp("hold_date_on"),
  holdDateOff: timestamp("hold_date_off"),
  contractCancelled: boolean("contract_cancelled").default(false),
  cancelReason: text("cancel_reason"),
  cancelDate: timestamp("cancel_date"),
  salesArea: text("sales_area"),
  salesDirector: text("sales_director"),
  balanceReason: text("balance_reason"),
  oldBalanceReason: text("old_balance_reason"),
  invoiceSameAsCustomer: boolean("invoice_same_as_customer").default(true),
  invoiceName: text("invoice_name"),
  invoiceHouseName: text("invoice_house_name"),
  invoiceHouseNumber: text("invoice_house_number"),
  invoiceStreet: text("invoice_street"),
  invoiceLocality: text("invoice_locality"),
  invoiceTown: text("invoice_town"),
  invoiceCounty: text("invoice_county"),
  invoicePostcode: text("invoice_postcode"),
  fittingSameAsCustomer: boolean("fitting_same_as_customer").default(true),
  fittingHouseName: text("fitting_house_name"),
  fittingHouseNumber: text("fitting_house_number"),
  fittingStreet: text("fitting_street"),
  fittingLocality: text("fitting_locality"),
  fittingTown: text("fitting_town"),
  fittingCounty: text("fitting_county"),
  fittingPostcode: text("fitting_postcode"),
  fittingWhat3Words: text("fitting_what_3_words"),
  fittingDirections: text("fitting_directions"),
  sendLettersToFitting: boolean("send_letters_to_fitting").default(false),
  estimatedFittingDays: decimal("estimated_fitting_days", { precision: 5, scale: 1 }),
  installationCompleted: text("installation_completed"),
  signboardLeft: boolean("signboard_left").default(false),
  signboardDate: text("signboard_date"),
  guaranteeNumber: text("guarantee_number"),
  guaranteeDate: text("guarantee_date"),
  insuranceBackedGuaranteeRef: text("insurance_backed_guarantee_ref"),
  notes: text("notes"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  quoteNumber: text("quote_number").notNull(),
  leadId: varchar("lead_id").references(() => leads.id),
  customerId: varchar("customer_id").references(() => customers.id),
  status: text("status").default("draft"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  tax: decimal("tax", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 10, scale: 2 }),
  validUntil: timestamp("valid_until"),
  notes: text("notes"),
  lineItems: jsonb("line_items"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  jobNumber: text("job_number").notNull(),
  quoteId: varchar("quote_id").references(() => quotes.id),
  customerId: varchar("customer_id").references(() => customers.id),
  status: text("status").default("scheduled"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  assignedTeam: text("assigned_team").array(),
  installationType: text("installation_type"),
  windowCount: integer("window_count"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  type: text("type").notNull(),
  description: text("description").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  leadId: varchar("lead_id").references(() => leads.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  jobId: varchar("job_id").references(() => jobs.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  customerId: varchar("customer_id").references(() => customers.id),
  content: text("content").notNull(),
  direction: text("direction").notNull(),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  category: text("category").notNull(),
  quantity: integer("quantity").default(0),
  minQuantity: integer("min_quantity").default(5),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  supplier: text("supplier"),
  description: text("description"),
});

export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  customerId: varchar("customer_id").references(() => customers.id),
  title: text("title").notNull(),
  type: text("type").default("appointment"),
  date: timestamp("date").notNull(),
  time: text("time"),
  duration: integer("duration").default(60),
  location: text("location"),
  assignedTo: text("assigned_to"),
  status: text("status").default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  customerId: varchar("customer_id").references(() => customers.id),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileUrl: text("file_url").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  context: text("context").default("lead"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leadNotes = pgTable("lead_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  customerId: varchar("customer_id").references(() => customers.id),
  content: text("content").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contractProducts = pgTable("contract_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  productName: text("product_name").notNull(),
  description: text("description"),
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const financeLines = pgTable("finance_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  lineType: text("line_type").notNull(),
  chargeAmount: decimal("charge_amount", { precision: 10, scale: 2 }),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  paymentMethod: text("payment_method"),
  invoiceNumber: text("invoice_number"),
  invoiceDetails: text("invoice_details"),
  paymentDate: timestamp("payment_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const financePayments = pgTable("finance_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  financeLineId: varchar("finance_line_id").references(() => financeLines.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"),
  paymentDate: text("payment_date"),
  reference: text("reference"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deliveryLines = pgTable("delivery_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  itemName: text("item_name").notNull(),
  comments: text("comments"),
  supplierName: text("supplier_name"),
  orderedByInitials: text("ordered_by_initials"),
  netValue: decimal("net_value", { precision: 10, scale: 2 }),
  dateOrdered: text("date_ordered"),
  quantityOrdered: integer("quantity_ordered").default(1),
  deliveryDueDate: text("delivery_due_date"),
  quantityReceived: integer("quantity_received").default(0),
  dateReceived: text("date_received"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const staffMembers = pgTable("staff_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role"),
  roles: text("roles").array(),
  defaultHourlyRate: decimal("default_hourly_rate", { precision: 10, scale: 2 }),
  email: text("email"),
  phone: text("phone"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commissions = pgTable("commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  date: text("date"),
  commissionType: text("commission_type"),
  staffMemberId: varchar("staff_member_id").references(() => staffMembers.id),
  staffMemberName: text("staff_member_name"),
  details: text("details"),
  commissionPercent: decimal("commission_percent", { precision: 5, scale: 2 }),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }),
  hours: decimal("hours", { precision: 6, scale: 2 }),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  travelHours: decimal("travel_hours", { precision: 6, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  comments: text("comments"),
  holdReason: text("hold_reason"),
  paid: boolean("paid").default(false),
  datePaid: text("date_paid"),
  paidBy: text("paid_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  town: text("town"),
  county: text("county"),
  postcode: text("postcode"),
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobInvoices = pgTable("job_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  date: text("date"),
  invoiceNumber: text("invoice_number"),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  supplierName: text("supplier_name"),
  description: text("description"),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }),
  documentId: varchar("document_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contractNotes = pgTable("contract_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  content: text("content").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fittingAppointments = pgTable("fitting_appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  workType: text("work_type").default("initial_fitting"),
  description: text("description"),
  comments: text("comments"),
  date: text("date"),
  time: text("time"),
  durationDays: decimal("duration_days", { precision: 5, scale: 1 }),
  durationHours: decimal("duration_hours", { precision: 5, scale: 1 }),
  travelTime: text("travel_time"),
  confirmed: boolean("confirmed").default(false),
  confirmedMethod: text("confirmed_method"),
  confirmedDate: text("confirmed_date"),
  confirmedBy: text("confirmed_by"),
  locked: boolean("locked").default(false),
  provisional: boolean("provisional").default(false),
  completed: boolean("completed").default(false),
  completedDate: text("completed_date"),
  assignedStaffIds: text("assigned_staff_ids").array(),
  assignedStaffNames: text("assigned_staff_names").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stockItems = pgTable("stock_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  name: text("name").notNull(),
  unitOfMeasurement: text("unit_of_measurement").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  supplierName: text("supplier_name"),
  description: text("description"),
  barcodeValue: text("barcode_value"),
  barcodeData: text("barcode_data"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  name: text("name").notNull(),
  description: text("description"),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  supplierName: text("supplier_name"),
  warranty: text("warranty"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stockLocations = pgTable("stock_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertLeadNoteSchema = createInsertSchema(leadNotes).omit({ id: true, createdAt: true });
export const insertContractProductSchema = createInsertSchema(contractProducts).omit({ id: true, createdAt: true });
export const insertFinanceLineSchema = createInsertSchema(financeLines).omit({ id: true, createdAt: true });
export const insertFinancePaymentSchema = createInsertSchema(financePayments).omit({ id: true, createdAt: true });
export const insertDeliveryLineSchema = createInsertSchema(deliveryLines).omit({ id: true, createdAt: true });
export const insertStaffMemberSchema = createInsertSchema(staffMembers).omit({ id: true, createdAt: true });
export const insertCommissionSchema = createInsertSchema(commissions).omit({ id: true, createdAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true });
export const insertJobInvoiceSchema = createInsertSchema(jobInvoices).omit({ id: true, createdAt: true });
export const insertContractNoteSchema = createInsertSchema(contractNotes).omit({ id: true, createdAt: true });
export const insertFittingAppointmentSchema = createInsertSchema(fittingAppointments).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertStockItemSchema = createInsertSchema(stockItems).omit({ id: true, createdAt: true });
export const insertStockLocationSchema = createInsertSchema(stockLocations).omit({ id: true, createdAt: true });

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertLeadNote = z.infer<typeof insertLeadNoteSchema>;
export type LeadNote = typeof leadNotes.$inferSelect;
export type InsertContractProduct = z.infer<typeof insertContractProductSchema>;
export type ContractProduct = typeof contractProducts.$inferSelect;
export type InsertFinanceLine = z.infer<typeof insertFinanceLineSchema>;
export type FinanceLine = typeof financeLines.$inferSelect;
export type InsertFinancePayment = z.infer<typeof insertFinancePaymentSchema>;
export type FinancePayment = typeof financePayments.$inferSelect;
export type InsertDeliveryLine = z.infer<typeof insertDeliveryLineSchema>;
export type DeliveryLine = typeof deliveryLines.$inferSelect;
export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;
export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissions.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertJobInvoice = z.infer<typeof insertJobInvoiceSchema>;
export type JobInvoice = typeof jobInvoices.$inferSelect;
export type InsertContractNote = z.infer<typeof insertContractNoteSchema>;
export type ContractNote = typeof contractNotes.$inferSelect;
export type InsertFittingAppointment = z.infer<typeof insertFittingAppointmentSchema>;
export type FittingAppointment = typeof fittingAppointments.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;
export type StockItem = typeof stockItems.$inferSelect;
export type InsertStockLocation = z.infer<typeof insertStockLocationSchema>;
export type StockLocation = typeof stockLocations.$inferSelect;

export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  customerId: text("customer_id"),
  companyName: text("company_name"),
  address: text("address"),
  telephone: text("telephone"),
  fax: text("fax"),
  email: text("email"),
  contact1Title: text("contact_1_title"),
  contact1Name: text("contact_1_name"),
  contact2Title: text("contact_2_title"),
  contact2Name: text("contact_2_name"),
  businessShortName: text("business_short_name"),
  vatNumber: text("vat_number"),
  website: text("website"),
  logo1Path: text("logo_1_path"),
  logo2Path: text("logo_2_path"),
  logo3Path: text("logo_3_path"),
  brandColor1: text("brand_color_1"),
  brandColor2: text("brand_color_2"),
  checklistEnabled: boolean("checklist_enabled").default(false),
  defaultQuoteTypeId: integer("default_quote_type_id"),
  ttEnabled: boolean("tt_enabled").default(false),
  ttUserId: text("tt_user_id"),
  ttApiKey: text("tt_api_key"),
  ttAutoPush: boolean("tt_auto_push").default(false),
  smsEnabled: boolean("sms_enabled").default(false),
  smsSenderName: text("sms_sender_name"),
  twilioPhoneNumber: text("twilio_phone_number"),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true });
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;

export const leadResults = pgTable("lead_results", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  category: text("category").notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const insertLeadResultSchema = createInsertSchema(leadResults).omit({ id: true });
export type InsertLeadResult = z.infer<typeof insertLeadResultSchema>;
export type LeadResult = typeof leadResults.$inferSelect;

export const quoteTypes = pgTable("quote_types", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const checklistTemplates = pgTable("checklist_templates", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  quoteTypeId: integer("quote_type_id").references(() => quoteTypes.id).notNull(),
  sortOrder: integer("sort_order").default(0),
  actionName: text("action_name").notNull(),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  assignedById: varchar("assigned_by_id").references(() => users.id),
  locked: boolean("locked").default(false),
  dueDateMode: text("due_date_mode").default("same_day"),
  daysToAdd: integer("days_to_add").default(0),
  daysRelativeTo: text("days_relative_to").default("previous_completed"),
  notifyOnComplete: boolean("notify_on_complete").default(false),
  notifyUserIds: text("notify_user_ids").array(),
  notificationTemplate: text("notification_template"),
  notificationEmailSubject: text("notification_email_subject"),
  notificationEmailBody: text("notification_email_body"),
  notifySmsOnComplete: boolean("notify_sms_on_complete").default(false),
  smsTemplate: text("sms_template"),
  customerNotifyOnComplete: boolean("customer_notify_on_complete").default(false),
  customerEmailSubject: text("customer_email_subject"),
  customerEmailBody: text("customer_email_body"),
  customerNotifySms: boolean("customer_notify_sms").default(false),
  customerSmsTemplate: text("customer_sms_template"),
  notificationFromAddressId: varchar("notification_from_address_id"),
  notificationSignature: text("notification_signature"),
  priority: text("priority").default("medium"),
});

export const leadChecklistItems = pgTable("lead_checklist_items", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  templateId: integer("template_id").references(() => checklistTemplates.id),
  sortOrder: integer("sort_order").default(0),
  actionName: text("action_name").notNull(),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  assignedById: varchar("assigned_by_id").references(() => users.id),
  locked: boolean("locked").default(false),
  dueDate: timestamp("due_date"),
  status: text("status").default("pending"),
  completedById: varchar("completed_by_id"),
  completedByName: text("completed_by_name"),
  completedAt: timestamp("completed_at"),
  notifyOnComplete: boolean("notify_on_complete").default(false),
  notificationTemplate: text("notification_template"),
  comment: text("comment"),
  priority: text("priority").default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuoteTypeSchema = createInsertSchema(quoteTypes).omit({ id: true });
export type InsertQuoteType = z.infer<typeof insertQuoteTypeSchema>;
export type QuoteType = typeof quoteTypes.$inferSelect;

export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplates).omit({ id: true });
export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;

export const insertLeadChecklistItemSchema = createInsertSchema(leadChecklistItems).omit({ id: true, createdAt: true });
export type InsertLeadChecklistItem = z.infer<typeof insertLeadChecklistItemSchema>;
export type LeadChecklistItem = typeof leadChecklistItems.$inferSelect;

export type User = typeof users.$inferSelect;

export const contractTypes = pgTable("contract_types", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContractTypeSchema = createInsertSchema(contractTypes).omit({ id: true, createdAt: true });
export type InsertContractType = z.infer<typeof insertContractTypeSchema>;
export type ContractType = typeof contractTypes.$inferSelect;

export const contractChecklistTemplates = pgTable("contract_checklist_templates", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  contractTypeId: integer("contract_type_id").references(() => contractTypes.id).notNull(),
  sortOrder: integer("sort_order").default(0),
  actionName: text("action_name").notNull(),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  assignedById: varchar("assigned_by_id").references(() => users.id),
  locked: boolean("locked").default(false),
  dueDateMode: text("due_date_mode").default("same_day"),
  daysToAdd: integer("days_to_add").default(0),
  daysRelativeTo: text("days_relative_to").default("previous_completed"),
  notifyOnComplete: boolean("notify_on_complete").default(false),
  notifyUserIds: text("notify_user_ids").array(),
  notificationTemplate: text("notification_template"),
  notificationEmailSubject: text("notification_email_subject"),
  notificationEmailBody: text("notification_email_body"),
  notifySmsOnComplete: boolean("notify_sms_on_complete").default(false),
  smsTemplate: text("sms_template"),
  customerNotifyOnComplete: boolean("customer_notify_on_complete").default(false),
  customerEmailSubject: text("customer_email_subject"),
  customerEmailBody: text("customer_email_body"),
  customerNotifySms: boolean("customer_notify_sms").default(false),
  customerSmsTemplate: text("customer_sms_template"),
  notificationFromAddressId: varchar("notification_from_address_id"),
  notificationSignature: text("notification_signature"),
  priority: text("priority").default("medium"),
});

export const insertContractChecklistTemplateSchema = createInsertSchema(contractChecklistTemplates).omit({ id: true });
export type InsertContractChecklistTemplate = z.infer<typeof insertContractChecklistTemplateSchema>;
export type ContractChecklistTemplate = typeof contractChecklistTemplates.$inferSelect;

export const contractChecklistItems = pgTable("contract_checklist_items", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  templateId: integer("template_id").references(() => contractChecklistTemplates.id),
  sortOrder: integer("sort_order").default(0),
  actionName: text("action_name").notNull(),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  assignedById: varchar("assigned_by_id").references(() => users.id),
  locked: boolean("locked").default(false),
  dueDate: timestamp("due_date"),
  status: text("status").default("pending"),
  completedById: varchar("completed_by_id"),
  completedByName: text("completed_by_name"),
  completedAt: timestamp("completed_at"),
  notifyOnComplete: boolean("notify_on_complete").default(false),
  notificationTemplate: text("notification_template"),
  comment: text("comment"),
  priority: text("priority").default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContractChecklistItemSchema = createInsertSchema(contractChecklistItems).omit({ id: true, createdAt: true });
export type InsertContractChecklistItem = z.infer<typeof insertContractChecklistItemSchema>;
export type ContractChecklistItem = typeof contractChecklistItems.$inferSelect;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id"),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  leadId: varchar("lead_id").references(() => leads.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  checklistItemId: integer("checklist_item_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const chatChannels = pgTable("chat_channels", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatChannelMembers = pgTable("chat_channel_members", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => chatChannels.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => chatChannels.id).notNull(),
  companyId: varchar("company_id").notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessageReads = pgTable("chat_message_reads", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => chatMessages.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  readAt: timestamp("read_at").defaultNow(),
});

export const insertChatChannelSchema = createInsertSchema(chatChannels).omit({ id: true, createdAt: true });
export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;
export type ChatChannel = typeof chatChannels.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type ChatChannelMember = typeof chatChannelMembers.$inferSelect;
export type ChatMessageRead = typeof chatMessageReads.$inferSelect;

export const stockTransactions = pgTable("stock_transactions", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id").notNull(),
  stockItemId: varchar("stock_item_id").references(() => stockItems.id).notNull(),
  stockLocationId: varchar("stock_location_id").references(() => stockLocations.id).notNull(),
  contractId: varchar("contract_id").references(() => contracts.id),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  supplierName: text("supplier_name"),
  notes: text("notes"),
  createdById: varchar("created_by_id"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStockTransactionSchema = createInsertSchema(stockTransactions).omit({ id: true, companyId: true, createdAt: true });
export type InsertStockTransaction = z.infer<typeof insertStockTransactionSchema>;
export type StockTransaction = typeof stockTransactions.$inferSelect;

export const emailDomains = pgTable("email_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  domain: text("domain").notNull(),
  sendgridDomainId: text("sendgrid_domain_id"),
  status: text("status").default("pending").notNull(),
  dnsRecords: jsonb("dns_records"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailSenderAddresses = pgTable("email_sender_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  domainId: varchar("domain_id").references(() => emailDomains.id),
  email: text("email").notNull(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userEmailSettings = pgTable("user_email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  companyId: varchar("company_id").notNull(),
  defaultFromAddressId: varchar("default_from_address_id"),
  emailSignature: text("email_signature"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailDomainSchema = createInsertSchema(emailDomains).omit({ id: true, createdAt: true });
export type InsertEmailDomain = z.infer<typeof insertEmailDomainSchema>;
export type EmailDomain = typeof emailDomains.$inferSelect;

export const insertEmailSenderAddressSchema = createInsertSchema(emailSenderAddresses).omit({ id: true, createdAt: true });
export type InsertEmailSenderAddress = z.infer<typeof insertEmailSenderAddressSchema>;
export type EmailSenderAddress = typeof emailSenderAddresses.$inferSelect;

export const insertUserEmailSettingsSchema = createInsertSchema(userEmailSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserEmailSettings = z.infer<typeof insertUserEmailSettingsSchema>;
export type UserEmailSettings = typeof userEmailSettings.$inferSelect;

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").default(""),
  category: text("category").default("custom"),
  blocks: jsonb("blocks").default([]).notNull(),
  globalStyles: jsonb("global_styles").default({}).notNull(),
  isIndustryTemplate: boolean("is_industry_template").default(false),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

export const emailCampaigns = pgTable("email_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  templateId: varchar("template_id").references(() => emailTemplates.id),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  fromAddressId: varchar("from_address_id").references(() => emailSenderAddresses.id),
  status: text("status").default("draft").notNull(),
  recipientCount: integer("recipient_count").default(0),
  sentCount: integer("sent_count").default(0),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
