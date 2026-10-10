import { Controller, Get, Param, Query, Redirect } from '@nestjs/common';
import { OidcService, Public } from '@nestjs/authentication';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Authentication')
@Public()
@Controller('auth/oidc')
export class OidcController {
  constructor(private readonly oidcService: OidcService) {}

  // "Sign in with Google" links here. With ?link=true, "Connect Google"
  // links the Google account to the signed-in customer instead.
  @ApiOperation({
    summary: 'Initiate the OpenID Connect login flow for a given provider',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to the provider login page',
  })
  @Get(':provider/login')
  @Redirect()
  login(
    @Param('provider') provider: string,
    @Query('redirectTo') redirectTo?: string,
    @Query('link') link?: string,
  ) {
    return this.oidcService.start(provider, {
      redirectTo,
      link: link === 'true',
    });
  }

  // Where Google sends the browser back.
  @ApiOperation({
    summary: 'Handle the callback from the OpenID Connect provider',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to the final destination after login',
  })
  @Get(':provider/callback')
  @Redirect()
  callback(
    @Param('provider') provider: string,
    @Query() query: Record<string, string>,
  ) {
    return this.oidcService.finish(provider, query);
  }
}
