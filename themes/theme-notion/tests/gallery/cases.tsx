import { Bell, Calendar, CircleCheck, FileText, Folder, Inbox, Plus, Search, Settings, TriangleAlert } from "lucide-react";
import type { ReactElement } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertTitle,
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
  Badge,
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  DetailTable,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  FilterChip,
  FilterChipAdd,
  FoldRow,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  Kbd,
  KbdGroup,
  Label,
  MarkPopover,
  PageFrame,
  PageHeader,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Progress,
  RadioGroup,
  RadioGroupItem,
  PropertyList,
  ScrollArea,
  ScrollBar,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SidePanel,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  Skeleton,
  Spinner,
  StatCards,
  SortableActivator,
  SortableHandle,
  SortableItem,
  SortableList,
  Steps,
  StatPills,
  StatsFold,
  Status,
  Switch,
  TabBar,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Code,
  CodeBlock,
} from "../../src/index.js";

/** One rendering of the gallery: a component, a variant or a composition, as an app would use it. */
export interface GalleryCase {
  /** Unique, stable: the key of the parity fixture and of the visual page. */
  readonly name: string;
  /** The component (or composition) the case shows, as exported from the package root. */
  readonly component: string;
  /** The cva options the case selects, by prop name, for the variant coverage check. */
  readonly options?: Readonly<Record<string, string>>;
  /** A CSS selector the rendered case must contain: its root. */
  readonly root: string;
  /**
   * Drawn on a page of its own in the visual gallery: an open overlay (portalled to body, fixed) or a fixed sidebar,
   * which would cover the other cases.
   */
  readonly isIsolated?: boolean;
  /** On the visual page, the element to click first: a part that only opens on a click (no open prop). */
  readonly clickToOpen?: string;
  readonly render: () => ReactElement;
}

/** The cva variant axes of the ui files, by the component that takes them; tests compare it with the sources. */
export const CVA_AXES: Readonly<Record<string, { readonly component: string; readonly axes: Readonly<Record<string, readonly string[]>> }>> = {
  alertVariants: {
    component: "Alert",
    axes: { variant: ["default", "destructive", "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] },
  },
  badgeVariants: {
    component: "Badge",
    axes: {
      variant: ["default", "secondary", "destructive", "outline", "ghost", "link", "tag"],
      color: ["none", "default", "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"],
    },
  },
  buttonGroupVariants: { component: "ButtonGroup", axes: { orientation: ["horizontal", "vertical"] } },
  buttonVariants: {
    component: "Button",
    axes: {
      variant: ["default", "destructive", "outline", "secondary", "ghost", "link", "floating"],
      size: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
  },
  emptyMediaVariants: { component: "EmptyMedia", axes: { variant: ["default", "icon"] } },
  fieldVariants: { component: "Field", axes: { orientation: ["vertical", "horizontal", "responsive"] } },
  inputGroupAddonVariants: { component: "InputGroupAddon", axes: { align: ["inline-start", "inline-end", "block-start", "block-end"] } },
  inputGroupButtonVariants: { component: "InputGroupButton", axes: { size: ["xs", "sm", "icon-xs", "icon-sm"] } },
  itemVariants: { component: "Item", axes: { variant: ["default", "outline", "muted"], size: ["default", "sm"] } },
  itemMediaVariants: { component: "ItemMedia", axes: { variant: ["default", "icon", "image"] } },
  sidebarMenuButtonVariants: { component: "SidebarMenuButton", axes: { variant: ["default", "outline"], size: ["default", "sm", "lg"] } },
  tabsListVariants: { component: "TabsList", axes: { variant: ["default", "line"] } },
};

type Options = Readonly<Record<string, string>>;

/** Every combination of the axes of one cva, as option records. */
function combine(axes: Readonly<Record<string, readonly string[]>>): Options[] {
  return Object.entries(axes).reduce<Options[]>(
    (combinations, [prop, values]) => combinations.flatMap((combination) => values.map((value) => ({ ...combination, [prop]: value }))),
    [{}],
  );
}

function describeOptions(options: Options): string {
  return Object.entries(options)
    .map(([prop, value]) => `${prop}=${value}`)
    .join(",");
}

/** One case per combination of a cva's axes. */
function matrix(cva: keyof typeof CVA_AXES, root: string, draw: (options: Options) => ReactElement): GalleryCase[] {
  const { component, axes } = CVA_AXES[cva] ?? { component: "", axes: {} };
  return combine(axes).map((options) => ({
    name: `${component}[${describeOptions(options)}]`,
    component,
    options,
    root,
    render: () => draw(options),
  }));
}

/** One case per value of one axis. */
function axis(cva: keyof typeof CVA_AXES, prop: string, root: string, draw: (value: string) => ReactElement): GalleryCase[] {
  const { component, axes } = CVA_AXES[cva] ?? { component: "", axes: {} };
  return (axes[prop] ?? []).map((value) => ({
    name: `${component}[${prop}=${value}]`,
    component,
    options: { [prop]: value },
    root,
    render: () => draw(value),
  }));
}

const PALETTE = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;

// A 1 × 1 transparent PNG: an avatar image that loads offline.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function SidebarDemo({ collapsible, side, variant }: { collapsible?: "offcanvas" | "icon" | "none"; side?: "left" | "right"; variant?: "sidebar" | "floating" | "inset" }) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible={collapsible} side={side} variant={variant}>
        <SidebarHeader>
          <SidebarInput placeholder="Search" aria-label="Search" />
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupAction title="Add page">
              <Plus />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <Inbox />
                    <span>Inbox</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>12</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Projects">
                    <Folder />
                    <span>Projects</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction showOnHover aria-label="Add a project page">
                    <Plus />
                  </SidebarMenuAction>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="#roadmap" isActive>
                        <span>Roadmap</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="#notes" size="sm">
                        <span>Notes</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 px-4">
          <SidebarTrigger />
          <span className="text-ui-medium">Inbox</span>
        </header>
      </SidebarInset>
    </SidebarProvider>
  );
}

const UI_CASES: readonly GalleryCase[] = [
  {
    name: "Accordion",
    component: "Accordion",
    root: '[data-slot="accordion"]',
    render: () => (
      <Accordion type="single" defaultValue="one" collapsible className="w-80">
        <AccordionItem value="one">
          <AccordionTrigger>What is a workspace?</AccordionTrigger>
          <AccordionContent>A shared space for pages and databases.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="two">
          <AccordionTrigger>Who can see it?</AccordionTrigger>
          <AccordionContent>Its members.</AccordionContent>
        </AccordionItem>
      </Accordion>
    ),
  },
  ...axis("alertVariants", "variant", '[data-slot="alert"]', (variant) => (
    <Alert variant={variant as "default"} className="w-96">
      <TriangleAlert />
      <AlertTitle>Payment overdue</AlertTitle>
      <AlertDescription>The invoice was due on Monday.</AlertDescription>
    </Alert>
  )),
  {
    name: "AlertDialog",
    component: "AlertDialog",
    root: '[data-slot="alert-dialog-content"]',
    isIsolated: true,
    render: () => (
      <AlertDialog defaultOpen>
        <AlertDialogTrigger asChild>
          <Button variant="outline">Delete</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <TriangleAlert />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete the page?</AlertDialogTitle>
            <AlertDialogDescription>It moves to the trash for 30 days.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  },
  {
    name: "AlertDialog[size=sm]",
    component: "AlertDialog",
    root: '[data-slot="alert-dialog-content"][data-size="sm"]',
    isIsolated: true,
    render: () => (
      <AlertDialog defaultOpen>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave the page?</AlertDialogTitle>
            <AlertDialogDescription>Unsaved changes are lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Stay</AlertDialogCancel>
            <AlertDialogAction size="sm" variant="destructive">
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  },
  ...(["sm", "default", "lg"] as const).map(
    (size): GalleryCase => ({
      name: `Avatar[size=${size}]`,
      component: "Avatar",
      root: `[data-slot="avatar"][data-size="${size}"]`,
      render: () => (
        <AvatarGroup>
          <Avatar size={size}>
            <AvatarImage src={PIXEL} alt="" />
            <AvatarFallback>JA</AvatarFallback>
            <AvatarBadge />
          </Avatar>
          <Avatar size={size}>
            <AvatarFallback>KM</AvatarFallback>
          </Avatar>
          <AvatarGroupCount>+3</AvatarGroupCount>
        </AvatarGroup>
      ),
    }),
  ),
  ...matrix("badgeVariants", '[data-slot="badge"]', ({ variant, color }) => (
    <Badge variant={variant as "default"} color={color as "none"}>
      <CircleCheck />
      Marketing
    </Badge>
  )),
  {
    name: "Breadcrumb",
    component: "Breadcrumb",
    root: '[data-slot="breadcrumb"]',
    render: () => (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#workspace">Workspace</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Roadmap</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ),
  },
  ...matrix("buttonVariants", '[data-slot="button"]', ({ variant, size }) => (
    <Button variant={variant as "default"} size={size as "default"} aria-label={size?.startsWith("icon") === true ? "Add" : undefined}>
      <Plus />
      {size?.startsWith("icon") === true ? null : "New page"}
    </Button>
  )),
  ...axis("buttonGroupVariants", "orientation", '[data-slot="button-group"]', (orientation) => (
    <ButtonGroup orientation={orientation as "horizontal"}>
      <ButtonGroupText>View</ButtonGroupText>
      <Button variant="outline">Table</Button>
      <ButtonGroupSeparator />
      <Button variant="outline">Board</Button>
    </ButtonGroup>
  )),
  {
    name: "Card",
    component: "Card",
    root: '[data-slot="card"]',
    render: () => (
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Monthly report</CardTitle>
          <CardDescription>October, all projects</CardDescription>
          <CardAction>
            <Button variant="ghost" size="icon-sm" aria-label="Settings">
              <Settings />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>Twelve pages changed this month.</CardContent>
        <CardFooter>
          <Button size="sm">Open</Button>
        </CardFooter>
      </Card>
    ),
  },
  {
    name: "Checkbox",
    component: "Checkbox",
    root: '[data-slot="checkbox"]',
    render: () => (
      <div className="flex items-center gap-3">
        <Checkbox aria-label="Unchecked" />
        <Checkbox aria-label="Checked" defaultChecked />
        <Checkbox aria-label="Invalid" aria-invalid />
        <Checkbox aria-label="Disabled" disabled defaultChecked />
      </div>
    ),
  },
  {
    name: "Collapsible",
    component: "Collapsible",
    root: '[data-slot="collapsible"]',
    render: () => (
      <Collapsible defaultOpen className="w-80">
        <CollapsibleTrigger asChild>
          <Button variant="ghost">Details</Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="text-ui">Created on 3 October.</CollapsibleContent>
      </Collapsible>
    ),
  },
  {
    name: "Command",
    component: "Command",
    root: '[data-slot="command"]',
    render: () => (
      <Command className="w-80">
        <CommandInput placeholder="Search pages" />
        <CommandList>
          <CommandEmpty>No pages.</CommandEmpty>
          <CommandGroup heading="Pages">
            <CommandItem>
              <FileText />
              Roadmap
              <CommandShortcut>⌘R</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Calendar />
              Calendar
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <Settings />
              Preferences
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    ),
  },
  {
    name: "CommandDialog",
    component: "CommandDialog",
    root: '[data-slot="dialog-content"] [data-slot="command"]',
    isIsolated: true,
    render: () => (
      <CommandDialog open>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandGroup heading="Pages">
            <CommandItem>Roadmap</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    ),
  },
  {
    name: "Dialog",
    component: "Dialog",
    root: '[data-slot="dialog-content"]',
    isIsolated: true,
    render: () => (
      <Dialog defaultOpen>
        <DialogTrigger asChild>
          <Button>Share</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share the page</DialogTitle>
            <DialogDescription>Anyone with the link can view it.</DialogDescription>
          </DialogHeader>
          <Input aria-label="Link" defaultValue="https://example.com/roadmap" readOnly />
          <DialogFooter showCloseButton>
            <Button>Copy link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ),
  },
  {
    name: "DialogClose",
    component: "DialogClose",
    root: '[data-slot="dialog-close"]',
    isIsolated: true,
    render: () => (
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Saved</DialogTitle>
          <DialogDescription>The page is saved.</DialogDescription>
          <DialogClose asChild>
            <Button variant="secondary">Done</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    ),
  },
  {
    name: "DropdownMenu",
    component: "DropdownMenu",
    root: '[data-slot="dropdown-menu-content"]',
    isIsolated: true,
    render: () => (
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Options</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Page</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <FileText />
              Duplicate
              <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem inset>Move to</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked>Full width</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="small">
            <DropdownMenuRadioItem value="small">Small text</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="large">Large text</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub defaultOpen>
            <DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>PDF</DropdownMenuItem>
              <DropdownMenuItem>Markdown</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
  ...axis("emptyMediaVariants", "variant", '[data-slot="empty"]', (variant) => (
    <Empty className="w-96">
      <EmptyHeader>
        <EmptyMedia variant={variant as "default"}>
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>No pages yet</EmptyTitle>
        <EmptyDescription>Create the first page of the workspace.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">New page</Button>
      </EmptyContent>
    </Empty>
  )),
  ...axis("fieldVariants", "orientation", '[data-slot="field"]', (orientation) => (
    <FieldSet className="w-96">
      <FieldLegend>Profile</FieldLegend>
      <FieldDescription>Shown to the workspace.</FieldDescription>
      <FieldGroup>
        <Field orientation={orientation as "vertical"}>
          <FieldLabel htmlFor={`name-${orientation}`}>Name</FieldLabel>
          <Input id={`name-${orientation}`} defaultValue="Ada" />
        </Field>
        <FieldSeparator>or</FieldSeparator>
        <Field orientation={orientation as "vertical"} data-invalid>
          <FieldContent>
            <FieldTitle>E-mail</FieldTitle>
            <FieldDescription>Used to sign in.</FieldDescription>
          </FieldContent>
          <Input aria-label="E-mail" aria-invalid defaultValue="ada@" />
          <FieldError>Enter a full address.</FieldError>
        </Field>
      </FieldGroup>
    </FieldSet>
  )),
  {
    name: "FieldError[errors]",
    component: "FieldError",
    root: '[data-slot="field-error"]',
    render: () => <FieldError errors={[{ message: "Too short." }, { message: "Needs a digit." }]} />,
  },
  {
    name: "Input",
    component: "Input",
    root: '[data-slot="input"]',
    render: () => (
      <div className="flex w-80 flex-col gap-2">
        <Input aria-label="Title" placeholder="Untitled" />
        <Input aria-label="Invalid" aria-invalid defaultValue="?" />
        <Input aria-label="Disabled" disabled defaultValue="Locked" />
        <Input aria-label="File" type="file" />
      </div>
    ),
  },
  ...axis("inputGroupAddonVariants", "align", '[data-slot="input-group"]', (align) => (
    <InputGroup className="w-80">
      {align.startsWith("block") ? (
        <InputGroupTextarea aria-label="Note" defaultValue="A note" />
      ) : (
        <InputGroupInput aria-label="Search" placeholder="Search" />
      )}
      <InputGroupAddon align={align as "inline-start"}>
        <Search />
        <InputGroupText>Find</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  )),
  ...axis("inputGroupButtonVariants", "size", '[data-slot="input-group"]', (size) => (
    <InputGroup className="w-80">
      <InputGroupInput aria-label="Link" defaultValue="https://example.com" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size={size as "xs"} aria-label="Copy">
          {size.startsWith("icon") ? <FileText /> : "Copy"}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )),
  ...matrix("itemVariants", '[data-slot="item"]', ({ variant, size }) => (
    <ItemGroup className="w-96">
      <Item variant={variant as "default"} size={size as "default"}>
        <ItemHeader>Project</ItemHeader>
        <ItemMedia variant="icon">
          <Folder />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Roadmap</ItemTitle>
          <ItemDescription>Updated today</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="sm" variant="outline">
            Open
          </Button>
        </ItemActions>
        <ItemFooter>3 pages</ItemFooter>
      </Item>
      <ItemSeparator />
    </ItemGroup>
  )),
  ...axis("itemMediaVariants", "variant", '[data-slot="item-media"]', (variant) => (
    <Item className="w-96">
      <ItemMedia variant={variant as "default"}>{variant === "image" ? <img src={PIXEL} alt="" /> : <Bell />}</ItemMedia>
      <ItemContent>
        <ItemTitle>Reminder</ItemTitle>
      </ItemContent>
    </Item>
  )),
  {
    name: "Kbd",
    component: "Kbd",
    root: '[data-slot="kbd-group"]',
    render: () => (
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    ),
  },
  {
    name: "Label",
    component: "Label",
    root: '[data-slot="label"]',
    render: () => (
      <div className="flex items-center gap-2">
        <Checkbox id="label-terms" />
        <Label htmlFor="label-terms">Accept the terms</Label>
      </div>
    ),
  },
  {
    name: "Popover",
    component: "Popover",
    root: '[data-slot="popover-content"]',
    isIsolated: true,
    render: () => (
      <Popover defaultOpen>
        <PopoverAnchor asChild>
          <span>Anchor</span>
        </PopoverAnchor>
        <PopoverTrigger asChild>
          <Button variant="outline">Filter</Button>
        </PopoverTrigger>
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>Filter</PopoverTitle>
            <PopoverDescription>Show pages changed this week.</PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    ),
  },
  {
    name: "Progress",
    component: "Progress",
    root: '[data-slot="progress"]',
    render: () => <Progress value={60} aria-label="Done" className="w-80" />,
  },
  {
    name: "RadioGroup",
    component: "RadioGroup",
    root: '[data-slot="radio-group"]',
    render: () => (
      <RadioGroup defaultValue="weekly" aria-label="Report frequency">
        {["daily", "weekly", "monthly"].map((value) => (
          <div key={value} className="flex items-center gap-2 text-ui">
            <RadioGroupItem value={value} id={`frequency-${value}`} />
            <Label htmlFor={`frequency-${value}`}>{value}</Label>
          </div>
        ))}
        <div className="flex items-center gap-2 text-ui">
          <RadioGroupItem value="never" id="frequency-never" disabled />
          <Label htmlFor="frequency-never">never</Label>
        </div>
      </RadioGroup>
    ),
  },
  {
    name: "ScrollArea",
    component: "ScrollArea",
    root: '[data-slot="scroll-area"]',
    render: () => (
      <ScrollArea className="h-24 w-64 rounded-md border">
        <div className="w-96 p-3 text-ui">
          {Array.from({ length: 8 }, (_, line) => (
            <p key={line}>Line {line + 1} of the changelog</p>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    ),
  },
  ...(["default", "sm"] as const).map(
    (size): GalleryCase => ({
      name: `SelectTrigger[size=${size}]`,
      component: "SelectTrigger",
      root: `[data-slot="select-trigger"][data-size="${size}"]`,
      render: () => (
        <Select defaultValue="table">
          <SelectTrigger size={size} aria-label="View" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="table">Table</SelectItem>
          </SelectContent>
        </Select>
      ),
    }),
  ),
  {
    name: "Select",
    component: "Select",
    root: '[data-slot="select-content"]',
    isIsolated: true,
    render: () => (
      <Select defaultValue="table" defaultOpen>
        <SelectTrigger aria-label="View" className="w-48">
          <SelectValue placeholder="View" />
        </SelectTrigger>
        <SelectContent>
          <SelectScrollUpButton />
          <SelectGroup>
            <SelectLabel>Views</SelectLabel>
            <SelectItem value="table">
              <FileText />
              Table
            </SelectItem>
            <SelectItem value="board">Board</SelectItem>
            <SelectItem value="list" disabled>
              List
            </SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="calendar">Calendar</SelectItem>
          <SelectScrollDownButton />
        </SelectContent>
      </Select>
    ),
  },
  {
    name: "Separator",
    component: "Separator",
    root: '[data-slot="separator"]',
    render: () => (
      <div className="flex h-8 w-80 flex-col gap-2">
        <Separator />
        <div className="flex h-4 gap-2">
          <span>Pages</span>
          <Separator orientation="vertical" />
          <span>Files</span>
        </div>
      </div>
    ),
  },
  ...(["top", "right", "bottom", "left"] as const).map(
    (side): GalleryCase => ({
      name: `Sheet[side=${side}]`,
      component: "Sheet",
      root: `[data-slot="sheet-content"]`,
      isIsolated: true,
      render: () => (
        <Sheet defaultOpen>
          <SheetTrigger asChild>
            <Button variant="outline">Open</Button>
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle>Page settings</SheetTitle>
              <SheetDescription>Layout and sharing.</SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="secondary">Close</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ),
    }),
  ),
  ...(["offcanvas", "icon", "none"] as const).map(
    (collapsible): GalleryCase => ({
      name: `Sidebar[collapsible=${collapsible}]`,
      component: "Sidebar",
      root: collapsible === "none" ? '[data-slot="sidebar"]' : '[data-slot="sidebar-container"]',
      isIsolated: true,
      render: () => <SidebarDemo collapsible={collapsible} />,
    }),
  ),
  ...(["floating", "inset"] as const).map(
    (variant): GalleryCase => ({
      name: `Sidebar[variant=${variant}]`,
      component: "Sidebar",
      root: `[data-slot="sidebar"][data-variant="${variant}"]`,
      isIsolated: true,
      render: () => <SidebarDemo variant={variant} />,
    }),
  ),
  {
    name: "Sidebar[side=right]",
    component: "Sidebar",
    root: '[data-slot="sidebar"][data-side="right"]',
    isIsolated: true,
    render: () => <SidebarDemo side="right" />,
  },
  ...combine(CVA_AXES["sidebarMenuButtonVariants"]?.axes ?? {}).map(
    (options): GalleryCase => ({
      name: `SidebarMenuButton[${describeOptions(options)}]`,
      component: "SidebarMenuButton",
      options,
      root: '[data-slot="sidebar-menu-button"]',
      render: () => (
        <SidebarProvider defaultOpen className="min-h-0">
          <SidebarMenu className="w-60">
            <SidebarMenuItem>
              <SidebarMenuButton variant={options["variant"] as "default"} size={options["size"] as "default"}>
                <Inbox />
                <span>Inbox</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarProvider>
      ),
    }),
  ),
  {
    name: "Skeleton",
    component: "Skeleton",
    root: '[data-slot="skeleton"]',
    render: () => (
      <div className="flex w-80 flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    ),
  },
  {
    name: "Toaster",
    component: "Toaster",
    root: "section[aria-label]",
    render: () => <Toaster />,
  },
  {
    name: "Spinner",
    component: "Spinner",
    root: '[role="status"]',
    render: () => <Spinner />,
  },
  ...(["default", "sm"] as const).map(
    (size): GalleryCase => ({
      name: `Switch[size=${size}]`,
      component: "Switch",
      root: `[data-slot="switch"][data-size="${size}"]`,
      render: () => (
        <div className="flex items-center gap-3">
          <Switch size={size} aria-label="Off" />
          <Switch size={size} aria-label="On" defaultChecked />
          <Switch size={size} aria-label="Disabled" disabled />
        </div>
      ),
    }),
  ),
  {
    name: "Table",
    component: "Table",
    root: '[data-slot="table"]',
    render: () => (
      <Table className="w-full max-w-[32rem]">
        <TableCaption>Invoices of October</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>INV-001</TableCell>
            <TableCell>Paid</TableCell>
            <TableCell className="text-right">1,200</TableCell>
          </TableRow>
          <TableRow data-state="selected">
            <TableCell>INV-002</TableCell>
            <TableCell>Due</TableCell>
            <TableCell className="text-right">300</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right">1,500</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    ),
  },
  ...axis("tabsListVariants", "variant", '[data-slot="tabs"]', (variant) => (
    <Tabs defaultValue="pages" className="w-96">
      <TabsList variant={variant as "default"}>
        <TabsTrigger value="pages">Pages</TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="trash" disabled>
          Trash
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pages">Twelve pages.</TabsContent>
      <TabsContent value="files">Three files.</TabsContent>
    </Tabs>
  )),
  {
    name: "Tabs[orientation=vertical]",
    component: "Tabs",
    root: '[data-slot="tabs"][data-orientation="vertical"]',
    render: () => (
      <Tabs defaultValue="pages" orientation="vertical">
        <TabsList>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="pages">Twelve pages.</TabsContent>
      </Tabs>
    ),
  },
  {
    name: "Textarea",
    component: "Textarea",
    root: '[data-slot="textarea"]',
    render: () => <Textarea aria-label="Comment" placeholder="Add a comment" className="w-80" />,
  },
  {
    name: "Tooltip",
    component: "Tooltip",
    root: '[data-slot="tooltip-content"]',
    isIsolated: true,
    render: () => (
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
  },
];

function FilterRow({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <FilterChip label="Status:" value={isActive ? "Failed" : "all"} isActive={isActive} icon={<CircleCheck aria-hidden="true" />}>
        <DropdownMenuRadioGroup value={isActive ? "failed" : "all"}>
          <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="failed">Failed</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </FilterChip>
      <FilterChipAdd>
        <DropdownMenuItem>Date</DropdownMenuItem>
      </FilterChipAdd>
    </div>
  );
}

const NOTION_CASES: readonly GalleryCase[] = [
  {
    name: "Code",
    component: "Code",
    root: '[data-slot="code"]',
    render: () => (
      <p className="text-ui">
        Run <Code>npm ci</Code> first.
      </p>
    ),
  },
  ...[false, true].map(
    (wrap): GalleryCase => ({
      name: `CodeBlock[wrap=${String(wrap)}]`,
      component: "CodeBlock",
      root: '[data-slot="code-block"]',
      render: () => (
        <CodeBlock label="Deploy log" wrap={wrap} className="w-80">
          {"$ softure-deploy release --environment production --version 0.4.7\nRelease 0.4.7 is live."}
        </CodeBlock>
      ),
    }),
  ),
  ...(["row", "handle", "activator"] as const).map(
    (dragBy): GalleryCase => ({
      name: `SortableList[dragBy=${dragBy}]`,
      component: "SortableList",
      root: '[data-slot="sortable-list"]',
      render: () => (
        <SortableList label="Stages" items={["plan", "build", "ship"]} onReorder={() => undefined} dragBy={dragBy} className="w-64">
          {["plan", "build", "ship"].map((id) => (
            <SortableItem key={id} id={id} className="flex items-center gap-2 px-2 py-1 text-ui">
              {dragBy === "handle" ? <SortableHandle /> : null}
              {dragBy === "activator" ? (
                <SortableActivator>
                  <button type="button">{id}</button>
                </SortableActivator>
              ) : (
                id
              )}
            </SortableItem>
          ))}
        </SortableList>
      ),
    }),
  ),
  {
    name: "DetailTable",
    component: "DetailTable",
    root: '[data-slot="detail-table"]',
    render: () => (
      <DetailTable
        label="Invoice details"
        rows={[
          { key: "number", label: "Number", value: "INV-001" },
          { key: "due", label: "Due", value: "3 November" },
        ]}
      />
    ),
  },
  ...[false, true].map(
    (isActive): GalleryCase => ({
      name: `FilterChip[isActive=${String(isActive)}]`,
      component: "FilterChip",
      root: '[data-slot="filter-chip"]',
      render: () => <FilterRow isActive={isActive} />,
    }),
  ),
  {
    name: "FilterChip[open]",
    component: "FilterChipAdd",
    root: '[data-slot="filter-chip-add"]',
    isIsolated: true,
    clickToOpen: '[data-slot="filter-chip"]',
    render: () => (
      <div className="p-6">
        <FilterRow isActive />
      </div>
    ),
  },
  {
    name: "FoldRow",
    component: "FoldRow",
    root: '[data-slot="fold-row"]',
    render: () => (
      <FoldRow
        title="Website redesign"
        facts={["12 pages", "3 owners"]}
        badges={[
          { key: "late", text: "Late", tone: "danger" },
          { key: "paid", text: "Paid", tone: "success" },
          { key: "note", text: "Note" },
        ]}
        detailsLabel="Project details"
        details={[{ key: "lead", label: "Lead", value: "Ada" }]}
      >
        <p>More about the project.</p>
      </FoldRow>
    ),
  },
  {
    name: "FoldRow[inset]",
    component: "FoldRow",
    root: '[data-slot="fold-row"]',
    render: () => (
      <FoldRow
        title="Website redesign"
        facts={["12 pages"]}
        badges={[{ key: "paid", text: "Paid", tone: "success" }]}
        detailsLabel="Project details"
        details={[{ key: "lead", label: "Lead", value: "Ada" }]}
        isInset
      />
    ),
  },
  {
    name: "FoldRow[summary]",
    component: "FoldRow",
    root: '[data-slot="fold-row"]',
    render: () => (
      <FoldRow summary={<span className="text-ui-medium">Website redesign</span>}>
        <p>Pages, owners and deadlines.</p>
      </FoldRow>
    ),
  },
  {
    name: "MarkPopover",
    component: "MarkPopover",
    root: '[data-slot="mark-popover"]',
    render: () => (
      <MarkPopover color="red" icon={TriangleAlert} count={2} label="2 open warnings, show the list" heading="Open warnings" closeLabel="Close">
        <span role="listitem">Payment overdue</span>
        <span role="listitem">Tickets to buy</span>
      </MarkPopover>
    ),
  },
  {
    name: "PageFrame",
    component: "PageFrame",
    root: "[data-page-frame]",
    render: () => (
      <PageFrame>
        <p className="p-4">A package page.</p>
      </PageFrame>
    ),
  },
  {
    name: "PageHeader",
    component: "PageHeader",
    root: '[data-slot="page-header"]',
    render: () => (
      <PageHeader
        title="Roadmap"
        crumbs={[{ label: "Workspace", href: "#workspace" }, { label: "Roadmap" }]}
        icon={<FileText />}
        description="What ships this quarter."
        actions={<Button size="sm">Share</Button>}
      >
        <Status color="green" icon={CircleCheck}>
          On track
        </Status>
      </PageHeader>
    ),
  },
  {
    name: "PropertyList",
    component: "PropertyList",
    root: '[data-slot="property-list"]',
    render: () => (
      <PropertyList
        className="w-96"
        items={[
          { label: "Status", value: <Badge variant="tag" color="green">Done</Badge>, icon: <CircleCheck /> },
          { label: "Due", value: "3 November", icon: <Calendar /> },
        ]}
      />
    ),
  },
  ...(["over", "left", "beside", "list"] as const).map(
    (layout): GalleryCase => ({
      name: `SidePanel[layout=${layout}]`,
      component: "SidePanel",
      root: `[data-slot="side-panel"][data-layout="${layout}"]`,
      render: () => (
        <div className="relative flex h-64 w-full bg-muted">
          <div className="flex-1" />
          <SidePanel id={`panel-${layout}`} heading="Layers" layout={layout} isOpen onClose={() => undefined}>
            <p className="text-ui">Traffic</p>
          </SidePanel>
        </div>
      ),
    }),
  ),
  {
    name: "Stats",
    component: "StatsFold",
    root: '[data-slot="stats-fold"]',
    render: () => (
      <StatsFold title="Summary">
          <StatCards
            label="Totals"
            cards={[
              { key: "paid", label: "Paid", value: "1,200", tone: "success" },
              { key: "owed", label: "Owed", value: "300", tone: "danger", hint: "2 invoices", aside: { text: "+5%", tone: "warning" } },
              { key: "plain", label: "Plain", value: "7", aside: { text: "new" } },
            ]}
          />
          <StatPills
            label="Counts"
            pills={[
              { key: "late", label: "Late", value: "1", tone: "danger" },
              { key: "open", label: "Open", value: "4" },
            ]}
          />
      </StatsFold>
    ),
  },
  ...(
    [
      [false, false],
      [true, false],
      [false, true],
    ] as const
  ).map(
    ([isFullWidth, isOneRow]): GalleryCase => ({
      name: `StatCards[isFullWidth=${String(isFullWidth)},isOneRow=${String(isOneRow)}]`,
      component: "StatCards",
      root: '[data-slot="stat-cards"]',
      render: () => (
        <StatCards
          label="Totals"
          isFullWidth={isFullWidth}
          isOneRow={isOneRow}
          cards={[
            { key: "a", label: "Booked", value: "21.5 h", tone: "success", icon: Calendar },
            { key: "b", label: "Left", value: "1.9 h", tone: "muted" },
          ]}
        />
      ),
    }),
  ),
  {
    name: "StatPills",
    component: "StatPills",
    root: '[data-slot="stat-pills"]',
    render: () => <StatPills label="Counts" pills={[{ key: "due", label: "Due", value: "2", tone: "warning" }]} />,
  },
  ...PALETTE.map(
    (color): GalleryCase => ({
      name: `Status[color=${color}]`,
      component: "Status",
      root: '[data-slot="status"]',
      render: () => (
        <Status color={color} icon={CircleCheck}>
          {color}
        </Status>
      ),
    }),
  ),
  ...(["row", "list"] as const).map(
    (layout): GalleryCase => ({
      name: `Steps[layout=${layout}]`,
      component: "Steps",
      root: `[data-slot="steps"][data-layout="${layout}"]`,
      render: () => (
        <Steps
          label="Invoice run"
          layout={layout}
          steps={[
            { key: "period", title: "Period", note: "October", state: "done" },
            { key: "document", title: "Document", note: "Drafting", state: "current", aside: <Badge variant="tag" color="blue">PDF</Badge> },
            { key: "mail", title: "E-mail draft", state: "failed", note: "Mailbox refused" },
            { key: "invoice", title: "Final invoice" },
          ]}
        />
      ),
    }),
  ),
  {
    name: "TabBar",
    component: "TabBar",
    root: '[data-slot="tab-bar"]',
    render: () => (
      <TabBar
        label="Project views"
        current="pages"
        tabs={[
          { key: "pages", label: "Pages", href: "#pages", icon: <FileText />, count: 12 },
          { key: "files", label: "Files", href: "#files", count: 0 },
          { key: "trash", label: "Trash", href: "#trash" },
        ]}
      />
    ),
  },
];

export const GALLERY_CASES: readonly GalleryCase[] = [...UI_CASES, ...NOTION_CASES];
