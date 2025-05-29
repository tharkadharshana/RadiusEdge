
"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { UploadCloud, Eye, Trash2, PlusCircle, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Mock data structure, replace with actual data fetching
interface Dictionary {
  id: string;
  name: string;
  source: string; // e.g., 'Standard', '3GPP', 'Custom Upload'
  attributes: number;
  vendorCodes: number;
  isActive: boolean;
  lastUpdated: string;
}

interface Attribute {
  id: string;
  name: string;
  code: string;
  type: string;
  vendor: string;
  description: string;
  enumValues?: string[];
  examples?: string;
}

const initialDictionaries: Dictionary[] = [
  { id: 'std', name: 'Standard RADIUS', source: 'Standard', attributes: 80, vendorCodes: 0, isActive: true, lastUpdated: '2023-01-15' },
  { id: '3gpp', name: '3GPP VSAs', source: '3GPP', attributes: 150, vendorCodes: 1, isActive: true, lastUpdated: '2023-05-20' },
  { id: 'cisco', name: 'Cisco VSAs', source: 'Cisco', attributes: 250, vendorCodes: 1, isActive: false, lastUpdated: '2022-11-10' },
  { id: 'custom-acme', name: 'ACME Corp Custom', source: 'Custom Upload', attributes: 20, vendorCodes: 1, isActive: true, lastUpdated: '2024-07-01' },
];

const exampleAttributes: Attribute[] = [
    { id: 'attr1', name: 'User-Name', code: '1', type: 'string', vendor: 'Standard', description: 'The username being authenticated.', examples: "User-Name = \"alice\"" },
    { id: 'attr2', name: 'NAS-IP-Address', code: '4', type: 'ipaddr', vendor: 'Standard', description: 'The IP address of the NAS initiating the request.', examples: "NAS-IP-Address = 192.168.1.1" },
    { id: 'attr3', name: '3GPP-IMSI', code: '1', type: 'string', vendor: '3GPP (10415)', description: 'International Mobile Subscriber Identity.', examples: "Vendor-Specific = 3GPP, 3GPP-IMSI = \"123456789012345\"" },
];


export default function DictionariesPage() {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>(initialDictionaries);
  const [selectedDictionary, setSelectedDictionary] = useState<Dictionary | null>(null);
  const [selectedAttribute, setSelectedAttribute] = useState<Attribute | null>(null);

  const toggleDictionaryActive = (id: string) => {
    setDictionaries(prev =>
      prev.map(dict =>
        dict.id === id ? { ...dict, isActive: !dict.isActive } : dict
      )
    );
  };

  const handleViewDictionary = (dictionary: Dictionary) => {
    setSelectedDictionary(dictionary);
    // In a real app, fetch attributes for this dictionary
  };
  
  const handleViewAttribute = (attribute: Attribute) => {
    setSelectedAttribute(attribute);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="RADIUS Dictionary Manager"
        description="Import, manage, and inspect RADIUS dictionaries and Vendor-Specific Attributes (VSAs)."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button><UploadCloud className="mr-2 h-4 w-4" /> Import Dictionary</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import New Dictionary</DialogTitle>
                <DialogDescription>Upload a FreeRADIUS compatible dictionary file.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="dict-name">Dictionary Name</Label>
                  <Input id="dict-name" placeholder="e.g., My Custom VSAs" />
                </div>
                <div>
                  <Label htmlFor="dict-file">Dictionary File</Label>
                  <Input id="dict-file" type="file" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button>Import</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Available Dictionaries</CardTitle>
          <CardDescription>Enable or disable dictionaries for use in scenarios and packet editing.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-center">Attributes</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dictionaries.map((dict) => (
                <TableRow key={dict.id}>
                  <TableCell className="font-medium">{dict.name}</TableCell>
                  <TableCell><Badge variant={dict.source === 'Custom Upload' ? 'secondary' : 'outline'}>{dict.source}</Badge></TableCell>
                  <TableCell className="text-center">{dict.attributes}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={dict.isActive}
                      onCheckedChange={() => toggleDictionaryActive(dict.id)}
                      aria-label={`Toggle ${dict.name} dictionary`}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => handleViewDictionary(dict)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog for Viewing Dictionary Attributes */}
      <Dialog open={!!selectedDictionary} onOpenChange={(isOpen) => !isOpen && setSelectedDictionary(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedDictionary?.name} Attributes</DialogTitle>
            <DialogDescription>Browse attributes within this dictionary.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attribute Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Mock: In real app, filter attributes for selectedDictionary */}
                {exampleAttributes.map(attr => (
                  <TableRow key={attr.id}>
                    <TableCell>{attr.name}</TableCell>
                    <TableCell>{attr.code}</TableCell>
                    <TableCell>{attr.type}</TableCell>
                    <TableCell>{attr.vendor}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewAttribute(attr)}>
                        <Info className="mr-1 h-4 w-4" /> Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Viewing Attribute Details */}
       <Dialog open={!!selectedAttribute} onOpenChange={(isOpen) => !isOpen && setSelectedAttribute(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribute: {selectedAttribute?.name}</DialogTitle>
            <DialogDescription>Details for RADIUS attribute.</DialogDescription>
          </DialogHeader>
          {selectedAttribute && (
            <div className="space-y-3 py-4 text-sm">
              <p><strong>Code:</strong> {selectedAttribute.code}</p>
              <p><strong>Type:</strong> {selectedAttribute.type}</p>
              <p><strong>Vendor:</strong> {selectedAttribute.vendor}</p>
              <p><strong>Description:</strong> {selectedAttribute.description}</p>
              {selectedAttribute.enumValues && (
                <p><strong>Allowed Values:</strong> {selectedAttribute.enumValues.join(', ')}</p>
              )}
              {selectedAttribute.examples && (
                <div>
                  <strong>Example Usage:</strong>
                  <pre className="mt-1 p-2 bg-muted rounded-md text-xs overflow-x-auto">{selectedAttribute.examples}</pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
