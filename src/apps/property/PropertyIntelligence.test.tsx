import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PropertyIntelligence from './PropertyIntelligence';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({ api: vi.fn() }));
const data={period:'2026-10',units:[{id:'unit',unitNumber:'101',floor:'Ground',status:'vacant'}],tenants:[],leases:[],charges:[],payments:[],expenses:[],layouts:[],utilityBills:[],deposits:[],inspections:[],workOrders:[],inbound:[],maintenance:[],financials:[{currency:'TZS',billed:1200000,collected:100000,earnedRent:100000,expenses:10000,arrears:1100000,cashNet:90000,operatingProfit:90000}],occupancy:{total:1,occupied:0},discrepancies:[],forecast:[],assumptions:[],autoInvoice:false};
afterEach(()=>{cleanup();vi.mocked(api).mockReset();});
function mock() {vi.mocked(api).mockImplementation(async(path)=> path === '/property/documents' ? [] : data as never);}
describe('Property intelligence interface',()=>{
  it('shows earned rent separately from cash and invoices',async()=>{mock();render(<PropertyIntelligence propertyId="property" onChanged={async()=>{}}/>);await screen.findByText('Earned rent');expect(screen.getByText('Cash collected')).toBeTruthy();expect(screen.getByText('Invoiced')).toBeTruthy();});
  it('requires reviewed approval and sends mapped layout data',async()=>{
    mock();const changed=vi.fn(async()=>{});render(<PropertyIntelligence propertyId="property" onChanged={changed}/>);
    await screen.findByText('Earned rent');fireEvent.click(screen.getByText('building'));fireEvent.click(screen.getByText('101'));
    const submit=screen.getByText('Approve and save');expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('I have reviewed these details and authorize this change.'));fireEvent.click(submit);
    await waitFor(()=>expect(changed).toHaveBeenCalled());
    const call=vi.mocked(api).mock.calls.find(([path])=>path==='/property/intelligence/actions');
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({kind:'layout',approved:true,payload:{unitId:'unit',floor:'Ground',corridor:'Main corridor',position:0}});
  });
  it('reports a backend failure instead of showing a success',async()=>{vi.mocked(api).mockRejectedValue(new Error('Database unavailable'));render(<PropertyIntelligence propertyId="property" onChanged={async()=>{}}/>);expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');});
});
