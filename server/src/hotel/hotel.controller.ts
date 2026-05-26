import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  BookingsService, GuestsService, MenuItemsService, OrdersService,
  RoomsService, ServiceRequestsService,
} from './hotel.service';
import {
  CreateBookingDto, CreateGuestDto, CreateMenuItemDto, CreateOrderDto, CreateRoomDto,
  CreateServiceRequestDto,
  UpdateBookingDto, UpdateGuestDto, UpdateMenuItemDto, UpdateOrderStatusDto, UpdateRoomDto,
  UpdateServiceRequestStatusDto,
} from './dto/hotel.dto';

@UseGuards(JwtAuthGuard)
@Controller('hotel')
export class HotelController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly guests: GuestsService,
    private readonly bookings: BookingsService,
    private readonly menu: MenuItemsService,
    private readonly orders: OrdersService,
    private readonly serviceRequests: ServiceRequestsService,
  ) {}

  @Get('rooms') listRooms(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.rooms.list(uid, { page: Number(page) || 1, limit: Number(limit) || 50 });
  }
  @Post('rooms') createRoom(@CurrentUser('id') uid: string, @Body() dto: CreateRoomDto) { return this.rooms.create(uid, dto); }
  @Patch('rooms/:id') updateRoom(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateRoomDto) { return this.rooms.update(uid, id, dto); }
  @Delete('rooms/:id') removeRoom(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.rooms.remove(uid, id); }

  @Get('guests') listGuests(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.guests.list(uid, { page: Number(page) || 1, limit: Number(limit) || 50 });
  }
  @Post('guests') createGuest(@CurrentUser('id') uid: string, @Body() dto: CreateGuestDto) { return this.guests.create(uid, dto); }
  @Patch('guests/:id') updateGuest(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateGuestDto) { return this.guests.update(uid, id, dto); }
  @Delete('guests/:id') removeGuest(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.guests.remove(uid, id); }

  @Get('bookings') listBookings(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.bookings.list(uid, { page: Number(page) || 1, limit: Number(limit) || 50 });
  }
  @Post('bookings') createBooking(@CurrentUser('id') uid: string, @Body() dto: CreateBookingDto) { return this.bookings.createBooking(uid, dto); }
  @Patch('bookings/:id') updateBooking(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateBookingDto) { return this.bookings.updateBooking(uid, id, dto); }
  @Delete('bookings/:id') removeBooking(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.bookings.remove(uid, id); }

  // Menu items
  @Get('menu-items') listMenuItems(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.menu.list(uid, { page: Number(page) || 1, limit: Number(limit) || 100 });
  }
  @Post('menu-items') createMenuItem(@CurrentUser('id') uid: string, @Body() dto: CreateMenuItemDto) { return this.menu.create(uid, dto); }
  @Patch('menu-items/:id') updateMenuItem(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateMenuItemDto) { return this.menu.update(uid, id, dto); }
  @Delete('menu-items/:id') removeMenuItem(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.menu.remove(uid, id); }

  // Orders (guest QR portal → kitchen/bar)
  @Get('orders') listOrders(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.orders.list(uid, { page: Number(page) || 1, limit: Number(limit) || 100 });
  }
  @Post('orders') placeOrder(@CurrentUser('id') uid: string, @Body() dto: CreateOrderDto) { return this.orders.placeOrder(uid, dto); }
  @Patch('orders/:id/status') updateOrderStatus(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) { return this.orders.updateStatus(uid, id, dto); }
  @Delete('orders/:id') removeOrder(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.orders.remove(uid, id); }

  // Service requests (housekeeping, towels, wake-up, etc.)
  @Get('service-requests') listServiceRequests(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.serviceRequests.list(uid, { page: Number(page) || 1, limit: Number(limit) || 100 });
  }
  @Post('service-requests') createServiceRequest(@CurrentUser('id') uid: string, @Body() dto: CreateServiceRequestDto) { return this.serviceRequests.create(uid, dto); }
  @Patch('service-requests/:id/status') updateServiceRequestStatus(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateServiceRequestStatusDto) { return this.serviceRequests.updateStatus(uid, id, dto); }
  @Delete('service-requests/:id') removeServiceRequest(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.serviceRequests.remove(uid, id); }
}
