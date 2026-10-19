// The shapes of the data read from the database

export type Category = { id: number; name: string; slug: string };
export type Owner = { id: number; name: string };
export type Status = { id: number; name: string; slug: string; color: string };

export type Item = {
  id: number;
  name: string;
  quantity: number;
  notes: string;
  image_url: string | null;
  // The picture to show
  image_source: string | null;
  metadata: Record<string, string>;
  status_id: number | null;
  status_name: string | null;
  status_color: string | null;
  category: string;
  category_id: number;
  owner: string;
  owner_id: number;
};

export type LegoSet = {
  set_num: string;
  name: string;
  year: number | null;
  theme: string;
  num_parts: number | null;
  img_url: string | null;
  // How many sets matched the search in total
  total_count: number;
};

// The lists shown in the dropdowns of the New item form
export type FormOptions = {
  categories: Category[];
  owners: Owner[];
  statuses: Status[];
};
